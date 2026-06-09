import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { cancelPayPalSubscription, getPayPalSubscriptionDetails, isPayPalConfigured } from '@/lib/paypal';
import { shouldUseSecureCookies } from '@/lib/runtimeConfig';
import { decryptJson, encryptJson, signValue } from '@/lib/security';
import {
  getLatestSupportLedgerRecordBySteamId,
  getLatestSupportSubscriptionLedgerRecordBySteamId,
  upsertSupportLedgerRecord,
} from '@/lib/server/supportLedgerStore';
import { SUPPORT_RECEIPT_MAX_AGE_SECONDS } from '@/lib/supportSessionConfig';

const CANCELLABLE_PAYPAL_STATES = new Set(['ACTIVE', 'APPROVAL_PENDING', 'SUSPENDED']);
const TERMINAL_PAYPAL_STATES = new Set(['CANCELLED', 'EXPIRED']);

function readEncryptedCookie(name) {
  const raw = cookies().get(name)?.value;
  try {
    return raw ? decryptJson(raw) : null;
  } catch {
    return null;
  }
}

function getSupportSubscriptionId(support) {
  if (!support) return null;
  if (support.subscriptionId) return support.subscriptionId;
  return support.identifierType === 'subscription' ? support.identifier : null;
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

function isLikelyPayPalSubscriptionId(value) {
  return typeof value === 'string' && /^[A-Z0-9\-]{8,64}$/i.test(value);
}

function buildCancelledReceipt({ steamUser, subscriptionId, previousSupport, paypalState, cancellationReason }) {
  const cancelledAt = new Date().toISOString();
  const verification = {
    provider: 'paypal',
    identifierType: 'subscription',
    identifier: subscriptionId,
    state: 'CANCELLED',
    paypalState,
    cancelledAt,
    source: 'tcentral_cancel_subscription_api',
  };

  return {
    provider: 'paypal',
    planId: previousSupport?.planId || null,
    identifier: subscriptionId,
    identifierType: 'subscription',
    subscriptionId,
    steamid: steamUser.steamid,
    personaname: steamUser.personaname || previousSupport?.personaname || null,
    linkedAt: previousSupport?.linkedAt || cancelledAt,
    cancelledAt,
    status: 'CANCELLED',
    verification,
    reference: signValue(`paypal:subscription:${subscriptionId}:${steamUser.steamid}:${cancelledAt}:cancelled`),
    metadata: {
      ...(previousSupport?.metadata || {}),
      cancellationReason,
      previousReference: previousSupport?.reference || previousSupport?.metadata?.reference || null,
    },
  };
}

async function persistCancelledSupport({ steamUser, subscriptionId, previousSupport, paypalState, cancellationReason, paypalEventType }) {
  const payload = buildCancelledReceipt({ steamUser, subscriptionId, previousSupport, paypalState, cancellationReason });

  await upsertSupportLedgerRecord({
    provider: 'paypal',
    planId: payload.planId,
    identifier: subscriptionId,
    identifierType: 'subscription',
    subscriptionId,
    steamid: steamUser.steamid,
    personaname: payload.personaname,
    status: 'CANCELLED',
    paypalEventType,
    verification: payload.verification,
    linkedAt: payload.linkedAt,
    metadata: {
      ...payload.metadata,
      reference: payload.reference,
      cancelledAt: payload.cancelledAt,
    },
  });

  return payload;
}

export async function POST(request) {
  if (!isPayPalConfigured()) {
    return NextResponse.json({ ok: false, error: 'PayPal is not configured' }, { status: 503 });
  }

  const useSecureCookies = shouldUseSecureCookies(request);
  const body = await request.json().catch(() => ({}));
  const steamUser = readEncryptedCookie('steam_session');

  if (!steamUser?.steamid) {
    return NextResponse.json({ ok: false, error: 'Steam login required before cancelling a subscription' }, { status: 401 });
  }

  const cookieSupport = readEncryptedCookie('support_receipt');
  let durableSupport = null;
  let subscriptionSupport = null;
  try {
    [durableSupport, subscriptionSupport] = await Promise.all([
      getLatestSupportLedgerRecordBySteamId(steamUser.steamid),
      getLatestSupportSubscriptionLedgerRecordBySteamId(steamUser.steamid),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown support ledger error';
    return NextResponse.json({ ok: false, error: `Support ledger lookup failed: ${message}` }, { status: 502 });
  }

  const previousSupport = subscriptionSupport || durableSupport || cookieSupport || null;
  const requestedSubscriptionId = typeof body?.subscriptionId === 'string' ? body.subscriptionId.trim() : '';
  const subscriptionId = requestedSubscriptionId || getSupportSubscriptionId(previousSupport);

  if (!subscriptionId || !isLikelyPayPalSubscriptionId(subscriptionId)) {
    return NextResponse.json({ ok: false, error: 'No valid PayPal subscription is linked to this Steam account' }, { status: 400 });
  }

  const linkedSubscriptionId = getSupportSubscriptionId(previousSupport);
  if (linkedSubscriptionId && linkedSubscriptionId !== subscriptionId) {
    return NextResponse.json({ ok: false, error: 'Requested subscription does not match the linked Steam support receipt' }, { status: 403 });
  }

  let subscription = null;
  try {
    subscription = await getPayPalSubscriptionDetails(subscriptionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch subscription details';
    return NextResponse.json({ ok: false, error: `PayPal subscription lookup failed: ${message}` }, { status: 502 });
  }

  const linkedSteamIds = collectPayPalSubscriptionSteamIds(subscription);
  if (linkedSteamIds.length > 0 && !linkedSteamIds.includes(String(steamUser.steamid))) {
    return NextResponse.json({ ok: false, error: 'PayPal subscription does not belong to this Steam account' }, { status: 403 });
  }

  const paypalState = String(subscription?.status || '').toUpperCase();
  const cancellationReason = String(body?.reason || 'T-Central.me account-management cancellation').trim().slice(0, 128);
  let alreadyCancelled = TERMINAL_PAYPAL_STATES.has(paypalState);

  if (!alreadyCancelled) {
    if (!CANCELLABLE_PAYPAL_STATES.has(paypalState)) {
      return NextResponse.json({ ok: false, error: `Subscription cannot be cancelled from status ${paypalState || 'UNKNOWN'}` }, { status: 409 });
    }

    try {
      await cancelPayPalSubscription(subscriptionId, cancellationReason);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to cancel subscription';
      return NextResponse.json({ ok: false, error: `PayPal cancellation failed: ${message}` }, { status: 502 });
    }
  }

  let cancelledReceipt = null;
  try {
    cancelledReceipt = await persistCancelledSupport({
      steamUser,
      subscriptionId,
      previousSupport,
      paypalState: alreadyCancelled ? paypalState : 'CANCEL_REQUESTED',
      cancellationReason,
      paypalEventType: alreadyCancelled ? 'BILLING.SUBSCRIPTION.CANCELLED' : 'TCENTRAL.SUBSCRIPTION.CANCEL_REQUESTED',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown support ledger error';
    return NextResponse.json({ ok: false, error: `Unable to persist cancellation: ${message}` }, { status: 502 });
  }

  const response = NextResponse.json({
    ok: true,
    cancelled: true,
    alreadyCancelled,
    subscriptionId,
    paypalState: alreadyCancelled ? paypalState : 'CANCEL_REQUESTED',
    support: {
      provider: cancelledReceipt.provider,
      identifier: cancelledReceipt.identifier,
      identifierType: cancelledReceipt.identifierType,
      subscriptionId: cancelledReceipt.subscriptionId,
      steamid: cancelledReceipt.steamid,
      status: cancelledReceipt.status,
      cancelledAt: cancelledReceipt.cancelledAt,
      reference: cancelledReceipt.reference,
    },
  });

  response.cookies.set({
    name: 'support_receipt',
    value: encryptJson(cancelledReceipt),
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: SUPPORT_RECEIPT_MAX_AGE_SECONDS,
  });

  return response;
}
