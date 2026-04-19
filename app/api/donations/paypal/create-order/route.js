import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptJson } from '@/lib/security';
import {
  createDonationIntent,
  persistDonationLedger,
  readDonationLedger,
  summarizeDonationLedger,
  upsertDonationRecord,
} from '@/lib/donationLedger';
import {
  createPayPalOrder,
  getPayPalCurrency,
  isPayPalConfigured,
} from '@/lib/paypal';

function normalizeDonationPayload(body = {}) {
  const rawAmount = String(body.amount ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(rawAmount)) {
    throw new Error('Amount must be a positive number with up to 2 decimal places');
  }

  const numericAmount = Number(rawAmount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 10000) {
    throw new Error('Amount must be between 0.01 and 10000.00');
  }

  const currencyInput = String(body.currency || '').trim().toUpperCase();
  const fallbackCurrency = getPayPalCurrency().toUpperCase();
  const currency = /^[A-Z]{3}$/.test(currencyInput) ? currencyInput : fallbackCurrency;

  const anchorSlug = String(body.anchorSlug || 'deep_blackhole')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 64) || 'deep_blackhole';

  const solarSystemKey = String(body.solarSystemKey || 'solar_system')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 64) || 'solar_system';

  return {
    amount: numericAmount.toFixed(2),
    currency,
    anchorSlug,
    solarSystemKey,
  };
}

function readSteamSession() {
  const cookieStore = cookies();
  const rawSteam = cookieStore.get('steam_session')?.value;
  try {
    return rawSteam ? decryptJson(rawSteam) : null;
  } catch {
    return null;
  }
}

export async function POST(request) {
  if (!isPayPalConfigured()) {
    return NextResponse.json({ ok: false, error: 'PayPal is not configured' }, { status: 503 });
  }

  const steamUser = readSteamSession();
  if (!steamUser?.steamid) {
    return NextResponse.json({ ok: false, error: 'Steam session required before creating orders' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  try {
    const { amount, currency, anchorSlug, solarSystemKey } = normalizeDonationPayload(body);
    const order = await createPayPalOrder({
      request,
      amount,
      currency,
      steamUser,
      anchorSlug,
      solarSystemKey,
    });

    if (!order?.id) {
      throw new Error('PayPal order ID missing from response');
    }

    const intent = createDonationIntent({
      steamUser,
      amount,
      currency,
      anchorSlug,
      solarSystemKey,
      orderId: order.id,
    });

    const nextLedger = upsertDonationRecord(readDonationLedger(), intent);
    const summary = summarizeDonationLedger(nextLedger);

    const response = NextResponse.json({
      ok: true,
      orderId: order.id,
      status: order.status || 'CREATED',
      intent,
      summary,
    });

    return persistDonationLedger(response, request, nextLedger);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unable to create order',
      },
      { status: 400 }
    );
  }
}
