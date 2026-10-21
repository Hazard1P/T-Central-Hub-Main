import { paymentOwner } from '../accountPayments.js';

const failure = () => new Error('Payment history is temporarily unavailable. Please retry; do not submit another payment.');
export function createAccountPaymentRepository(admin, { environment = 'live' } = {}) {
  const requireAdmin = () => { if (!admin) throw failure(); return admin; };
  async function begin(auth, selection, clientKey, mode = 'order') {
    const owner = paymentOwner(auth);
    const payload = { provider_environment: environment, account_provider: owner.provider, account_id: owner.accountId, client_key: clientKey, mode, kind: selection.kind, focus: selection.focus, amount_minor: selection.amountMinor, currency: selection.currency, product: selection.product };
    const { data, error } = await requireAdmin().from('account_payment_intents').insert(payload).select('*').single();
    if (!error) return data;
    if (error.code !== '23505') throw failure();
    const prior = await admin.from('account_payment_intents').select('*').eq('account_provider', owner.provider).eq('account_id', owner.accountId).eq('client_key', clientKey).maybeSingle();
    if (prior.error || !prior.data) throw failure();
    const saved = prior.data;
    if (saved.provider_environment !== environment || saved.amount_minor != selection.amountMinor || saved.currency !== selection.currency || saved.kind !== selection.kind || saved.focus !== selection.focus || saved.mode !== mode) throw new Error('This checkout request has already been used for a different selection.');
    return saved;
  }
  async function bind(intent, providerId) {
    if (intent.provider_id && intent.provider_id !== providerId) throw new Error('Payment binding conflict.');
    const result = await requireAdmin().from('account_payment_intents').update({ provider_id: providerId }).eq('id', intent.id).select('*').single();
    if (result.error) throw failure();
    return result.data;
  }
  async function find(providerId, auth = null) {
    let query = requireAdmin().from('account_payment_intents').select('*').eq('provider_id', providerId);
    if (auth) { const owner = paymentOwner(auth); query = query.eq('account_provider', owner.provider).eq('account_id', owner.accountId); }
    const result = await query.maybeSingle();
    if (result.error) throw failure();
    return result.data && ['unknown', environment].includes(result.data.provider_environment) ? result.data : null;
  }
  async function ownedIntent(id, auth) {
    const owner = paymentOwner(auth);
    const result = await requireAdmin().from('account_payment_intents').select('*').eq('id', id).eq('account_provider', owner.provider).eq('account_id', owner.accountId).maybeSingle();
    if (result.error) throw failure();
    return result.data;
  }
  async function charge(transactionId) {
    const result = await requireAdmin().from('account_payment_charges').select('*').eq('transaction_id', transactionId).maybeSingle();
    if (result.error) throw failure();
    return result.data;
  }
  async function record(intent, capture) {
    const result = await requireAdmin().rpc('record_account_payment', { p_intent: intent.id, p_transaction: capture.id, p_amount: capture.amountMinor, p_currency: capture.currency, p_paid_at: capture.paidAt, p_environment: environment });
    if (result.error) throw failure();
    return result.data;
  }
  async function adjust(transaction, adjustment, kind, amount, currency) {
    const result = await requireAdmin().rpc('adjust_account_payment', { p_transaction: transaction, p_adjustment: adjustment, p_kind: kind, p_amount: amount, p_currency: currency, p_environment: environment });
    if (result.error) throw failure();
    return result.data;
  }
  async function summary(auth = null) {
    const owner = auth ? paymentOwner(auth) : null;
    const result = await requireAdmin().rpc('account_payment_summary', { p_provider: owner?.provider || null, p_account_id: owner?.accountId || null, p_environment: environment });
    if (result.error) throw failure();
    return result.data;
  }
  async function legacySubscription(providerId) {
    const result = await requireAdmin().from('tcentral_support_ledger').select('*').eq('provider','paypal').eq('identifier_type','subscription').eq('identifier',providerId).maybeSingle();
    if (result.error) throw failure();
    return result.data;
  }
  async function event(eventId, type, reference, outcome) {
    const result = await requireAdmin().from('account_payment_events').upsert({ provider_environment: environment, event_id: eventId, event_type: type, provider_reference: reference || null, outcome }, { onConflict: 'provider_environment,event_id' });
    if (result.error) throw failure();
  }
  return { begin, bind, find, ownedIntent, charge, record, adjust, summary, event, legacySubscription };
}
