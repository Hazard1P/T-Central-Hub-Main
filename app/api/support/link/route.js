import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptJson, encryptJson, signValue } from '@/lib/security';
import { shouldUseSecureCookies } from '@/lib/runtimeConfig';
import {
  getPayPalSubscriptionDetails,
  getPayPalOrderDetails,
  getPayPalCaptureDetails,
} from '@/lib/paypal';
import { findPayPalWebhookRecord } from '@/lib/paypalWebhookStore';

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

function findPriorVerification({ steamid, identifier, identifierType }) {
  const durableRecord = findPayPalWebhookRecord({ identifierType, identifier });
  if (durableRecord?.steamid && String(durableRecord.steamid) === String(steamid)) {
    return durableRecord;
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

async function verifyPayPalIdentifier({ identifier, identifierType, steamid }) {
  if (identifierType === 'subscription') {
    const subscription = await getPayPalSubscriptionDetails(identifier);
    const state = String(subscription?.status || '').toUpperCase();
    if (!['ACTIVE', 'APPROVAL_PENDING'].includes(state)) {
      return { ok: false, error: `Subscription is not active (${state || 'UNKNOWN'})` };
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

  if (identifierType === 'order') {
    const order = await getPayPalOrderDetails(identifier);
    const state = String(order?.status || '').toUpperCase();

    if (!['COMPLETED', 'APPROVED'].includes(state)) {
      return { ok: false, error: `Order is not approved/completed (${state || 'UNKNOWN'})` };
    }

    const linkedSteamIds = (order?.purchase_units || [])
      .map((unit) => unit?.custom_id)
      .filter(Boolean)
      .map(String);

    if (linkedSteamIds.length > 0 && !linkedSteamIds.includes(String(steamid))) {
      return { ok: false, error: 'Order does not belong to this Steam account' };
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

  if (identifierType === 'capture') {
    const capture = await getPayPalCaptureDetails(identifier);
    const state = String(capture?.status || '').toUpperCase();

    if (state !== 'COMPLETED') {
      return { ok: false, error: `Capture is not completed (${state || 'UNKNOWN'})` };
    }

    const customId = capture?.custom_id || null;
    if (customId && String(customId) !== String(steamid)) {
      return { ok: false, error: 'Capture does not belong to this Steam account' };
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

  const priorVerification = findPriorVerification({
    steamid: steamUser.steamid,
    identifier,
    identifierType,
  });

  let verification = null;

  if (priorVerification) {
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
    maxAge: 60 * 60 * 24 * 90,
  });

  return response;
}
