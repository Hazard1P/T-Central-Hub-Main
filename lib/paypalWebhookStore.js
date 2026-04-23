const store = globalThis.__tcentralPayPalWebhookStore || {
  processedEventIds: new Set(),
  records: new Map(),
};

globalThis.__tcentralPayPalWebhookStore = store;

function nowIso() {
  return new Date().toISOString();
}

function recordKeys({ orderId, captureId, subscriptionId }) {
  return [
    orderId ? `order:${orderId}` : null,
    captureId ? `capture:${captureId}` : null,
    subscriptionId ? `subscription:${subscriptionId}` : null,
  ].filter(Boolean);
}

function normalizeStatus(value, fallback = 'RECEIVED') {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized || fallback;
}

function normalizeAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return amount.toFixed(2);
}

function findExistingRecord({ orderId, captureId, subscriptionId }) {
  const keys = recordKeys({ orderId, captureId, subscriptionId });
  for (const key of keys) {
    const existing = store.records.get(key);
    if (existing) {
      return existing;
    }
  }
  return null;
}

export function hasProcessedPayPalWebhookEvent(eventId) {
  return Boolean(eventId) && store.processedEventIds.has(String(eventId));
}

export function markPayPalWebhookEventProcessed(eventId) {
  if (!eventId) return;
  store.processedEventIds.add(String(eventId));
}

export function reconcilePayPalWebhookRecord(recordInput = {}) {
  const orderId = recordInput.orderId || null;
  const captureId = recordInput.captureId || null;
  const subscriptionId = recordInput.subscriptionId || null;

  const existing = findExistingRecord({ orderId, captureId, subscriptionId });
  const timestamp = nowIso();
  const merged = {
    ...(existing || {}),
    provider: 'paypal',
    orderId: orderId || existing?.orderId || null,
    captureId: captureId || existing?.captureId || null,
    subscriptionId: subscriptionId || existing?.subscriptionId || null,
    steamid: recordInput.steamid || existing?.steamid || null,
    personaname: recordInput.personaname || existing?.personaname || null,
    amount: normalizeAmount(recordInput.amount) || existing?.amount || null,
    currency: String(recordInput.currency || existing?.currency || 'USD').toUpperCase(),
    status: normalizeStatus(recordInput.status, normalizeStatus(existing?.status, 'RECEIVED')),
    paypalEventType: recordInput.paypalEventType || existing?.paypalEventType || null,
    lastEventId: recordInput.eventId || existing?.lastEventId || null,
    verification: {
      provider: 'paypal',
      identifierType: subscriptionId ? 'subscription' : captureId ? 'capture' : 'order',
      identifier: subscriptionId || captureId || orderId || existing?.verification?.identifier || null,
      state: normalizeStatus(recordInput.status, normalizeStatus(existing?.verification?.state, 'RECEIVED')),
      verifiedAt: timestamp,
      source: 'paypal_webhook',
    },
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  };

  for (const key of recordKeys(merged)) {
    store.records.set(key, merged);
  }

  return merged;
}

export function findPayPalWebhookRecord({ identifierType, identifier }) {
  if (!identifierType || !identifier) {
    return null;
  }

  const key = `${String(identifierType).toLowerCase()}:${String(identifier)}`;
  return store.records.get(key) || null;
}
