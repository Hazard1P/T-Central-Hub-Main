import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptJson, encryptJson, signValue } from '@/lib/security';
import { shouldUseSecureCookies } from '@/lib/runtimeConfig';
import {
  persistDonationLedger,
  readDonationLedger,
  summarizeDonationLedger,
  upsertDonationRecord,
} from '@/lib/donationLedger';
import { capturePayPalOrder, getPayPalCurrency, isPayPalConfigured } from '@/lib/paypal';

function readSteamSession() {
  const cookieStore = cookies();
  const rawSteam = cookieStore.get('steam_session')?.value;
  try {
    return rawSteam ? decryptJson(rawSteam) : null;
  } catch {
    return null;
  }
}

function normalizeOrderId(value) {
  const orderId = String(value || '').trim();
  if (!/^[A-Z0-9-]{8,64}$/i.test(orderId)) {
    throw new Error('Invalid PayPal orderId');
  }
  return orderId;
}

export async function POST(request) {
  if (!isPayPalConfigured()) {
    return NextResponse.json({ ok: false, error: 'PayPal is not configured' }, { status: 503 });
  }

  const steamUser = readSteamSession();
  if (!steamUser?.steamid) {
    return NextResponse.json({ ok: false, error: 'Steam session required before capturing orders' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  try {
    const orderId = normalizeOrderId(body.orderId);
    const captureOrder = await capturePayPalOrder(orderId);

    const unit = captureOrder?.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    const amountValue = Number(capture?.amount?.value || 0);
    const amount = Number.isFinite(amountValue) && amountValue > 0 ? amountValue.toFixed(2) : '0.00';
    const currency = String(capture?.amount?.currency_code || getPayPalCurrency()).toUpperCase();

    const current = readDonationLedger();
    const priorRecord = current.find((entry) => entry?.orderId === orderId && entry?.steamid === steamUser.steamid);

    const finalStatus = capture?.status === 'COMPLETED' ? 'CONFIRMED' : captureOrder?.status || 'CAPTURED';
    const nextLedger = upsertDonationRecord(current, {
      ...priorRecord,
      orderId,
      steamid: steamUser.steamid,
      personaname: steamUser.personaname || null,
      amount,
      currency,
      anchorSlug: priorRecord?.anchorSlug || 'deep_blackhole',
      solarSystemKey: priorRecord?.solarSystemKey || 'solar_system',
      status: finalStatus,
      captureId: capture?.id || null,
      capturedAt: capture?.create_time || new Date().toISOString(),
      paypalStatus: captureOrder?.status || null,
      verification: {
        provider: 'paypal',
        identifierType: 'capture',
        identifier: capture?.id || orderId,
        state: finalStatus,
        verifiedAt: capture?.create_time || new Date().toISOString(),
        source: 'capture_order',
      },
    });

    const summary = summarizeDonationLedger(nextLedger.filter((entry) => entry?.steamid === steamUser.steamid));
    const response = NextResponse.json({
      ok: true,
      orderId,
      capture: {
        id: capture?.id || null,
        status: capture?.status || captureOrder?.status || null,
        amount,
        currency,
      },
      ledger: summary,
      summary,
      supportLinked: finalStatus === 'CONFIRMED',
    });

    if (finalStatus === 'CONFIRMED') {
      const supportPayload = {
        provider: 'paypal',
        planId: null,
        identifier: capture?.id || orderId,
        identifierType: capture?.id ? 'capture' : 'order',
        steamid: steamUser.steamid,
        personaname: steamUser.personaname || null,
        linkedAt: new Date().toISOString(),
        verification: {
          provider: 'paypal',
          identifierType: capture?.id ? 'capture' : 'order',
          identifier: capture?.id || orderId,
          state: 'COMPLETED',
          verifiedAt: capture?.create_time || new Date().toISOString(),
          source: 'capture_order',
        },
        reference: signValue(`paypal:${capture?.id || orderId}:${steamUser.steamid}`),
      };

      response.cookies.set({
        name: 'support_receipt',
        value: encryptJson(supportPayload),
        httpOnly: true,
        secure: shouldUseSecureCookies(request),
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 90,
      });
    }

    return persistDonationLedger(response, request, nextLedger);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unable to capture order',
      },
      { status: 400 }
    );
  }
}
