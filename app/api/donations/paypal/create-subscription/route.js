import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptJson } from '@/lib/security';
import {
  createPayPalSubscription,
  getPayPalSubscriptionPlanId,
  isPayPalSubscriptionConfigured,
} from '@/lib/paypal';

function readSteamSession() {
  const rawSteam = cookies().get('steam_session')?.value;
  try {
    return rawSteam ? decryptJson(rawSteam) : null;
  } catch {
    return null;
  }
}

function normalizeIdempotencyKey(value) {
  const key = String(value || '').trim();
  if (!key) return '';
  if (!/^[a-zA-Z0-9:_-]{8,128}$/.test(key)) {
    throw new Error('Invalid idempotency key format');
  }
  return key;
}

export async function POST(request) {
  if (!isPayPalSubscriptionConfigured()) {
    return NextResponse.json({ ok: false, error: 'PayPal subscriptions are not configured' }, { status: 503 });
  }

  const steamUser = readSteamSession();
  if (!steamUser?.steamid) {
    return NextResponse.json({ ok: false, error: 'Steam session required before creating subscriptions' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    const configuredPlanId = getPayPalSubscriptionPlanId();
    const requestedPlanId = String(body?.planId || configuredPlanId).trim();
    if (requestedPlanId !== configuredPlanId) {
      return NextResponse.json({ ok: false, error: 'Unsupported PayPal subscription plan' }, { status: 400 });
    }

    const subscription = await createPayPalSubscription({
      request,
      steamUser,
      planId: configuredPlanId,
      idempotencyKey: normalizeIdempotencyKey(body?.idempotencyKey || request.headers.get('x-idempotency-key')),
    });

    if (!subscription?.id) {
      throw new Error('PayPal subscription ID missing from response');
    }

    return NextResponse.json({
      ok: true,
      subscriptionId: subscription.id,
      status: subscription.status || 'CREATED',
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unable to create subscription' },
      { status: 400 }
    );
  }
}
