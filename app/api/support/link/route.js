import { accountPayments } from '@/lib/server/accountPaymentStore';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptJson, encryptJson, signValue } from '@/lib/security';
import { shouldUseSecureCookies } from '@/lib/runtimeConfig';
import { SUPPORT_RECEIPT_MAX_AGE_SECONDS } from '@/lib/supportSessionConfig';
import {
  getPayPalSubscriptionDetails,
  getPayPalOrderDetails,
  getPayPalCaptureDetails,
} from '@/lib/paypal';
import { findPayPalWebhookRecord } from '@/lib/paypalWebhookStore';
import { findSupportLedgerRecord, upsertSupportLedgerRecord } from '@/lib/server/supportLedgerStore';

const ALLOWED_PROVIDER = 'paypal';
const VERIFIABLE_IDENTIFIER_TYPES = new Set(['subscription', 'order', 'capture']);

function normalizeSupportIdentifier(body) {
  const provider = String(body?.provider || ALLOWED_PROVIDER).toLowerCase();
  const identifier = body?.identifier || body?.subscriptionId || body?.orderId || body?.captureId || null;
  const identifierType = String(
    body?.identifierType ||
      (body?.subscriptionId ? 'subscription' : body?.orderId ? 'order' : body?.captureId ? 'capture' : ''),
  ).toLowerCase();

  return {
    provider,
    identifier: typeof identifier === 'string' ? identifier.trim() : '',
    identifierType,
  };
}

function isLikelyPayPalId(value) {
  return typeof value === 'string' && /^[A-Z0-9\-]{8,64}$/i.test(value);
}

function readSupportVerifications() {
  const cookieStore = cookies();
  const raw = cookieStore.get('tcentral_donations')?.value;
  try {
    const ledger = raw ? decryptJson(raw) : [];
    return Array.isArray(ledger) ? ledger : [];
  } catch {
    return [];
  }
}

async function findPriorVerification({ steamid, identifier, identifierType }) {
  const supportLedgerRecord = await findSupportLedgerRecord({
    provider: ALLOWED_PROVIDER,
    identifierType,
    identifier,
  });
  if (supportLedgerRecord?.steamid) {
    return String(supportLedgerRecord.steamid) === String(steamid) ? supportLedgerRecord : { ...supportLedgerRecord, steamidMismatch: true };
  }

  const durableRecord = findPayPalWebhookRecord({ identifierType, identifier });
  if (durableRecord?.steamid) {
    return String(durableRecord.steamid) === String(steamid) ? durableRecord : { ...durableRecord, steamidMismatch: true };
  }

  const ledger = readSupportVerifications();
  const verifiedStatuses = new Set(['VERIFIED', 'CONFIRMED', 'COMPLETED']);

  return ledger.find((entry) => {
    if (!entry || entry.steamid !== steamid) {
      return false;
    }

    const state = String(entry.verification?.state || entry.status || '').toUpperCase();
    if (!verifiedStatuses.has(state)) {
      return false;
    }

    if (identifierType === 'order') {
      return entry.orderId === identifier;
    }

    if (identifierType === 'capture') {
      return entry.captureId === identifier || entry.capture?.id === identifier;
    }

    if (identifierType === 'subscription') {
      return entry.subscriptionId === identifier || entry.paypalSubscriptionId === identifier;
    }

    return false;
  });
}


function collectPayPalSubscriptionSteamIds(subscription = {}) {
  return [
    subscription?.custom_id,
    subscription?.customId,
    subscription?.metadata?.steamid,
    subscription?.metadata?.steamId,
    subscription?.metadata?.steamID,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

async function verifyPayPalIdentifier({ identifier, identifierType, steamid }) {
  if (identifierType === 'subscription') {
    const subscription = await getPayPalSubscriptionDetails(identifier);
    const state = String(subscription?.status || '').toUpperCase();
    if (!['ACTIVE', 'APPROVAL_PENDING'].includes(state)) {
      return { ok: false, error: `Subscription is not active (${state || 'UNKNOWN'})` };
    }

    const linkedSteamIds = collectPayPalSubscriptionSteamIds(subscription);
    if (linkedSteamIds.length === 0) {
      return { ok: false, error: 'Subscription is missing Steam account binding metadata' };
    }

    if (!linkedSteamIds.includes(String(steamid))) {
      return { ok: false, error: 'Subscription does not belong to this Steam account' };
    }

    return {
      ok: true,
      verification: {
        provider: ALLOWED_PROVIDER,
        identifierType,
        identifier,
        state,
        verifiedAt: new Date().toISOString(),
        source: 'paypal_api',
      },
    };
  }

  if (identifierType === 'order' || identifierType === 'capture') {
    const store = accountPayments();
    const auth = { authenticated: true, provider: 'steam', accountId: String(steamid) };
    let charge, intent;
    if (identifierType === 'capture') {
      charge = await store.charge(identifier);
      intent = charge ? await store.ownedIntent(charge.intent_id, auth) : null;
    } else {
      intent = await store.find(identifier, auth);
      // A provider approval alone is not proof of a recorded payment.
      const order = intent ? await getPayPalOrderDetails(identifier) : null;
      const captureId = order?.purchase_units?.[0]?.payments?.captures?.[0]?.id;
      charge = captureId ? await store.charge(captureId) : null;
    }
    if (!intent || !charge || charge.intent_id !== intent.id) return { ok: false, error: 'No verified payment is linked to this account and reference.' };
    const capture = await getPayPalCaptureDetails(charge.transaction_id);
    if (capture.status !== 'COMPLETED') return { ok: false, error: 'This payment is not currently completed.' };
    return { ok: true, verification: { provider: ALLOWED_PROVIDER, identifierType, identifier, state: 'COMPLETED', verifiedAt: new Date().toISOString(), source: 'account_payment_record' } };
  }

  return { ok: false, error: 'Unsupported identifier type' };
}

export async function POST(request) {
  const useSecureCookies = shouldUseSecureCookies(request);
  const body = await request.json().catch(() => null);
  const planId = body?.planId || null;

  const { provider, identifier, identifierType } = normalizeSupportIdentifier(body);

  if (provider !== ALLOWED_PROVIDER) {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  }

  if (!VERIFIABLE_IDENTIFIER_TYPES.has(identifierType)) {
    return NextResponse.json({ error: 'Unsupported identifier type' }, { status: 400 });
  }

  if (!identifier || !isLikelyPayPalId(identifier)) {
    return NextResponse.json({ error: 'Invalid or unverifiable identifier' }, { status: 400 });
  }

  const cookieStore = cookies();
  const rawSteam = cookieStore.get('steam_session')?.value;
  let steamUser = null;

  try {
    steamUser = rawSteam ? decryptJson(rawSteam) : null;
  } catch {
    steamUser = null;
  }

  if (!steamUser?.steamid) {
    return NextResponse.json({ error: 'Steam login required before linking support' }, { status: 401 });
  }

  let priorVerification = null;
  try {
    priorVerification = await findPriorVerification({
      steamid: steamUser.steamid,
      identifier,
      identifierType,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown support ledger error';
    return NextResponse.json({ error: `Support ledger lookup failed: ${message}` }, { status: 502 });
  }

  if (priorVerification?.steamidMismatch) {
    return NextResponse.json({ error: 'Support identifier is already linked to another Steam account' }, { status: 403 });
  }

  let verification = null;

  if (priorVerification && identifierType === 'subscription') {
    verification = {
      provider: ALLOWED_PROVIDER,
      identifierType,
      identifier,
      state: String(priorVerification.verification?.state || priorVerification.status || 'VERIFIED').toUpperCase(),
      verifiedAt: priorVerification.verification?.verifiedAt || priorVerification.updatedAt || new Date().toISOString(),
      source: 'verified_event',
    };
  } else {
    try {
      const result = await verifyPayPalIdentifier({
        identifier,
        identifierType,
        steamid: steamUser.steamid,
      });

      if (!result.ok) {
        return NextResponse.json({ error: result.error || 'Unable to verify support identifier' }, { status: 400 });
      }

      verification = result.verification;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown verification error';
      return NextResponse.json({ error: `Support verification failed: ${message}` }, { status: 502 });
    }
  }

  const payload = {
    provider,
    planId,
    identifier,
    identifierType,
    steamid: steamUser.steamid,
    personaname: steamUser.personaname || null,
    linkedAt: new Date().toISOString(),
    verification,
    reference: signValue(`${provider}:${identifierType}:${identifier}:${steamUser.steamid}:${verification.verifiedAt}`),
  };

  try {
    await upsertSupportLedgerRecord({
      provider,
      planId,
      identifier,
      identifierType,
      subscriptionId: identifierType === 'subscription' ? identifier : null,
      orderId: identifierType === 'order' ? identifier : null,
      captureId: identifierType === 'capture' ? identifier : null,
      steamid: steamUser.steamid,
      personaname: steamUser.personaname || null,
      status: verification.state,
      verification,
      linkedAt: payload.linkedAt,
      metadata: { reference: payload.reference },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown support ledger error';
    return NextResponse.json({ error: `Unable to persist verified support ledger: ${message}` }, { status: 502 });
  }

  const response = NextResponse.json({
    ok: true,
    linked: {
      provider,
      identifier,
      identifierType,
      steamid: steamUser.steamid,
      personaname: steamUser.personaname || null,
      linkedAt: payload.linkedAt,
      verification,
      reference: payload.reference,
    },
  });
  response.cookies.set({
    name: 'support_receipt',
    value: encryptJson(payload),
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: SUPPORT_RECEIPT_MAX_AGE_SECONDS,
  });

  return response;
}
