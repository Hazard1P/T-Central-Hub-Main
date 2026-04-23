import { NextResponse } from 'next/server';
import { isPayPalConfigured, verifyPayPalWebhook } from '@/lib/paypal';
import {
  hasProcessedPayPalWebhookEvent,
  markPayPalWebhookEventProcessed,
  reconcilePayPalWebhookRecord,
} from '@/lib/paypalWebhookStore';

const SUPPORTED_WEBHOOK_EVENTS = new Set([
  'CHECKOUT.ORDER.APPROVED',
  'PAYMENT.CAPTURE.COMPLETED',
  'BILLING.SUBSCRIPTION.CREATED',
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
]);

function readResourceCustomId(resource = {}) {
  return (
    resource?.custom_id ||
    resource?.subscriber?.payer_id ||
    resource?.subscriber?.email_address ||
    null
  );
}

function parseWebhookRecord(event = {}) {
  const eventType = String(event?.event_type || '').trim().toUpperCase();
  const resource = event?.resource || {};

  if (eventType === 'CHECKOUT.ORDER.APPROVED') {
    return {
      eventType,
      orderId: resource?.id || null,
      captureId: null,
      subscriptionId: null,
      status: resource?.status || 'APPROVED',
      steamid: readResourceCustomId(resource),
      amount: resource?.purchase_units?.[0]?.amount?.value || null,
      currency: resource?.purchase_units?.[0]?.amount?.currency_code || null,
    };
  }

  if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
    const supplementary = resource?.supplementary_data?.related_ids || {};
    return {
      eventType,
      orderId: supplementary?.order_id || null,
      captureId: resource?.id || null,
      subscriptionId: supplementary?.subscription_id || null,
      status: resource?.status || 'COMPLETED',
      steamid: readResourceCustomId(resource),
      amount: resource?.amount?.value || null,
      currency: resource?.amount?.currency_code || null,
    };
  }

  if (eventType.startsWith('BILLING.SUBSCRIPTION.')) {
    return {
      eventType,
      orderId: null,
      captureId: null,
      subscriptionId: resource?.id || null,
      status: resource?.status || eventType.replace('BILLING.SUBSCRIPTION.', ''),
      steamid: readResourceCustomId(resource),
      amount: null,
      currency: null,
    };
  }

  return {
    eventType,
    orderId: null,
    captureId: null,
    subscriptionId: null,
    status: event?.summary || 'RECEIVED',
    steamid: null,
    amount: null,
    currency: null,
  };
}

function hasVerificationHeaders(request) {
  const required = [
    'paypal-auth-algo',
    'paypal-cert-url',
    'paypal-transmission-id',
    'paypal-transmission-sig',
    'paypal-transmission-time',
  ];

  return required.every((name) => Boolean(request.headers.get(name)));
}

export async function POST(request) {
  if (!isPayPalConfigured()) {
    return NextResponse.json({ ok: false, error: 'PayPal is not configured' }, { status: 503 });
  }

  if (!hasVerificationHeaders(request)) {
    return NextResponse.json({ ok: false, error: 'Missing required PayPal signature headers' }, { status: 400 });
  }

  const bodyText = await request.text();
  if (!bodyText) {
    return NextResponse.json({ ok: false, error: 'Missing webhook body' }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON webhook body' }, { status: 400 });
  }

  const eventId = String(event?.id || '').trim();
  if (!eventId) {
    return NextResponse.json({ ok: false, error: 'Missing webhook event ID' }, { status: 400 });
  }

  let signatureValid = false;
  try {
    signatureValid = await verifyPayPalWebhook({ request, bodyText });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unable to verify PayPal webhook signature' },
      { status: 400 }
    );
  }

  if (!signatureValid) {
    return NextResponse.json({ ok: false, error: 'PayPal signature verification failed' }, { status: 401 });
  }

  if (hasProcessedPayPalWebhookEvent(eventId)) {
    return NextResponse.json({ ok: true, duplicate: true, eventId });
  }

  const eventType = String(event?.event_type || '').trim().toUpperCase();
  const supported = SUPPORTED_WEBHOOK_EVENTS.has(eventType);

  if (!supported) {
    markPayPalWebhookEventProcessed(eventId);
    return NextResponse.json({ ok: true, ignored: true, eventId, eventType });
  }

  const parsed = parseWebhookRecord(event);
  const record = reconcilePayPalWebhookRecord({
    eventId,
    paypalEventType: parsed.eventType,
    orderId: parsed.orderId,
    captureId: parsed.captureId,
    subscriptionId: parsed.subscriptionId,
    status: parsed.status,
    steamid: parsed.steamid,
    amount: parsed.amount,
    currency: parsed.currency,
  });

  markPayPalWebhookEventProcessed(eventId);

  return NextResponse.json({
    ok: true,
    eventId,
    eventType,
    record: {
      orderId: record.orderId,
      captureId: record.captureId,
      subscriptionId: record.subscriptionId,
      status: record.status,
      steamid: record.steamid,
      updatedAt: record.updatedAt,
    },
  });
}
