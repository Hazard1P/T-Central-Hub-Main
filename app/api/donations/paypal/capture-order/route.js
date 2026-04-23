import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptJson, encryptJson, signValue } from '@/lib/security';
import { shouldUseSecureCookies } from '@/lib/runtimeConfig';
import { persistDonationLedger, readDonationLedger, summarizeDonationLedger, upsertDonationRecord } from '@/lib/donationLedger';
import { confirmDonationCapture, getDonationsBySteamId } from '@/lib/server/donationStore';
import { capturePayPalOrder, isPayPalConfigured } from '@/lib/paypal';

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

function normalizeIdempotencyKey(value) {
  const key = String(value || '').trim();
  if (!key) return '';
  if (!/^[a-zA-Z0-9:_-]{8,128}$/.test(key)) {
    throw new Error('Invalid idempotency key format');
  }
  return key;
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
    const idempotencyKey = normalizeIdempotencyKey(body.idempotencyKey || request.headers.get('x-idempotency-key'));

    const captureOrder = await capturePayPalOrder(orderId);
    const unit = captureOrder?.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];

    const { record, idempotentReplay } = await confirmDonationCapture({
      orderId,
      steamUser,
      capture,
      captureOrder,
      idempotencyKey: idempotencyKey || `capture:${orderId}`,
    });

    const { summary } = await getDonationsBySteamId(steamUser.steamid);

    const nextLedger = upsertDonationRecord(readDonationLedger(), record);
    const cacheSummary = summarizeDonationLedger(nextLedger.filter((entry) => entry?.steamid === steamUser.steamid));

    const response = NextResponse.json({
      ok: true,
      orderId,
      capture: {
        id: record.captureId,
        status: record.captureStatus || record.paypalStatus || record.status,
        amount: record.captureAmount || record.amount,
        currency: record.captureCurrency || record.currency,
      },
      summary,
      cacheSummary,
      supportLinked: record.status === 'CONFIRMED',
      idempotentReplay,
    });

    if (record.status === 'CONFIRMED') {
      const supportPayload = {
        provider: 'paypal',
        planId: null,
        identifier: record.captureId || orderId,
        identifierType: record.captureId ? 'capture' : 'order',
        steamid: steamUser.steamid,
        personaname: steamUser.personaname || null,
        linkedAt: new Date().toISOString(),
        verification: {
          provider: 'paypal',
          identifierType: record.captureId ? 'capture' : 'order',
          identifier: record.captureId || orderId,
          state: 'COMPLETED',
          verifiedAt: record.capturedAt || new Date().toISOString(),
          source: 'capture_order',
        },
        reference: signValue(`paypal:${record.captureId || orderId}:${steamUser.steamid}`),
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
