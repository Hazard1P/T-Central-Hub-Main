import { moneyToMinor, verifiedCapture } from '../accountPayments.js';

function relatedTransaction(resource) {
  const related = resource.supplementary_data?.related_ids || {};
  if (related.capture_id || resource.sale_id) return related.capture_id || resource.sale_id;
  for (const link of resource.links || []) {
    if (link.rel !== 'up') continue;
    try {
      const url = new URL(link.href);
      if (!['api.paypal.com','api-m.paypal.com','api.sandbox.paypal.com','api-m.sandbox.paypal.com'].includes(url.hostname)) continue;
      const match = url.pathname.match(/^\/v[12]\/payments\/(?:captures|sale)\/([a-zA-Z0-9-]+)$/);
      if (match) return match[1];
    } catch { /* Provider relationship must identify a known PayPal transaction. */ }
  }
  return null;
}
// Caller must verify the PayPal signature BEFORE invoking this reconciler.
export async function reconcileAccountPaymentEvent(event, { store, getOrder, getCapture, getSubscription }) {
  const resource = event.resource || {}, type = event.event_type;
  const related = resource.supplementary_data?.related_ids || {};
  let reference = resource.id || null;
  let handled = false;
  if (type === 'PAYMENT.CAPTURE.COMPLETED') {
    const orderId = related.order_id;
    const intent = orderId ? await store.find(orderId) : null;
    if (intent) {
      const capture = verifiedCapture(await getOrder(orderId), intent);
      if (!capture || capture.id !== resource.id) throw new Error('Capture event does not match verified order.');
      await store.record(intent, capture); handled = true;
    }
  } else if (type === 'PAYMENT.SALE.COMPLETED') {
    const subscriptionId = resource.billing_agreement_id || related.subscription_id;
    let intent = subscriptionId ? await store.find(subscriptionId) : null;
    if (!intent && subscriptionId && store.legacySubscription) {
      const legacy = await store.legacySubscription(subscriptionId);
      if (legacy?.steamid) {
        const subscription = await getSubscription(subscriptionId);
        if (String(subscription.custom_id) !== String(legacy.steamid)) throw new Error('Legacy subscription ownership requires review.');
        const currency = resource.amount?.currency || resource.amount?.currency_code;
        const amountMinor = moneyToMinor(resource.amount?.total || resource.amount?.value, currency);
        intent = await store.begin({ authenticated: true, provider: 'steam', accountId: String(legacy.steamid) }, { kind: 'support_subscription', focus: 'general', amountMinor, currency, product: { name: 'Verified legacy monthly support', version: 1, legacy: true, benefits: [] } }, `legacy-subscription:${subscriptionId}`, 'subscription');
        intent = await store.bind(intent, subscriptionId);
      }
    }
    if (intent) {
      const currency = resource.amount?.currency || resource.amount?.currency_code;
      const amount = resource.amount?.total || resource.amount?.value;
      if (resource.state !== 'completed' && resource.status !== 'COMPLETED') throw new Error('Subscription payment is not completed.');
      const amountMinor = moneyToMinor(amount, currency);
      if (amountMinor !== Number(intent.amount_minor) || currency !== intent.currency) throw new Error('Subscription payment price changed; review required.');
      await store.record(intent, { id: resource.id, amountMinor, currency, paidAt: resource.create_time || event.create_time }); handled = true;
    }
  } else if (['PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED','PAYMENT.SALE.REFUNDED','PAYMENT.SALE.REVERSED'].includes(type)) {
    const reversal = type.endsWith('REVERSED');
    const transaction = reversal ? resource.id : relatedTransaction(resource);
    reference = transaction;
    let charge = transaction ? await store.charge(transaction) : null;
    // A refund may be delivered before the corresponding completion webhook.
    if (!charge && transaction && type.startsWith('PAYMENT.CAPTURE.')) {
      const providerCapture = await getCapture(transaction);
      const orderId = providerCapture.supplementary_data?.related_ids?.order_id;
      const intent = orderId ? await store.find(orderId) : null;
      if (intent) {
        const capture = verifiedCapture(await getOrder(orderId), intent, { allowAdjusted: true });
        if (capture?.id === transaction) { await store.record(intent, capture); charge = await store.charge(transaction); }
      }
    }
    if (charge) {
      const currency = resource.amount?.currency_code || resource.amount?.currency;
      const amount = resource.amount?.value || resource.amount?.total;
      await store.adjust(transaction, reversal ? `reversal:${transaction}` : resource.id, reversal ? 'reversal' : 'refund', moneyToMinor(amount, currency), currency);
      handled = true;
    }
  } else return { handled: false, financial: false };
  await store.event(event.id, type, reference, handled ? 'recorded' : 'unmatched');
  return { handled, financial: true };
}
