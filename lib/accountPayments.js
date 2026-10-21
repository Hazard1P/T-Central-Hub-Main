// Money stays in integer minor units; currencies are never added together.
const ZERO_DECIMAL = new Set(['JPY', 'HUF', 'TWD']);
const SUPPORTED = new Set(['AUD','BRL','CAD','CHF','CZK','DKK','EUR','GBP','HKD','HUF','ILS','JPY','MXN','MYR','NOK','NZD','PHP','PLN','SEK','SGD','THB','TWD','USD']);
export function currencyDigits(currency) {
  if (!SUPPORTED.has(currency)) throw new Error('Unsupported currency');
  return ZERO_DECIMAL.has(currency) ? 0 : 2;
}
export function moneyToMinor(value, currency) {
  const digits = currencyDigits(currency);
  const text = String(value);
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error('Invalid money amount');
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > digits && /[1-9]/.test(fraction.slice(digits))) throw new Error('Too many decimal places');
  const minor = Number(BigInt(whole) * BigInt(10 ** digits) + BigInt((fraction.slice(0, digits).padEnd(digits, '0')) || '0'));
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > 1000000000) throw new Error('Amount outside supported range');
  return minor;
}
export function minorToMoney(value, currency) {
  const digits = currencyDigits(currency);
  if ((typeof value === 'number' && !Number.isSafeInteger(value)) || !/^\d+$/.test(String(value))) throw new Error('Invalid money amount');
  const amount = BigInt(value), scale = BigInt(10 ** digits);
  return digits ? `${amount / scale}.${String(amount % scale).padStart(digits, '0')}` : String(amount);
}
export function paymentOwner(auth) {
  if (!auth?.authenticated || !['steam', 'google'].includes(auth.provider) || !auth.accountId) throw new Error('Sign in with Steam or Google.');
  return { provider: auth.provider, accountId: String(auth.accountId), key: `${auth.provider}:${auth.accountId}` };
}
export const SUPPORT_FOCUS = { general: 'Whole project', development: 'Development', marketing: 'Marketing', hardware: 'Hardware and infrastructure' };
export function paymentSelection(input, currency) {
  // VIP purchases must resolve to a published server-controlled offer. No offers
  // are on sale yet; a client cannot label a donation as a VIP purchase.
  if (input.purchaseType && input.purchaseType !== 'donation') throw new Error('VIP purchases are not available yet.');
  const amountMinor = moneyToMinor(input.amount, currency);
  if (amountMinor > moneyToMinor('10000', currency)) throw new Error('Maximum contribution is 10,000.');
  if (input.currency && input.currency !== currency) throw new Error('Checkout currency changed. Please refresh.');
  return { amountMinor, currency, kind: 'donation', focus: Object.hasOwn(SUPPORT_FOCUS, input.focus) ? input.focus : 'general', product: { name: 'Voluntary project contribution', version: 1, benefits: [] } };
}
export function verifyOrderPayment(order, intent) {
  const units = order?.purchase_units;
  if (order?.id !== intent.provider_id || !Array.isArray(units) || units.length !== 1) throw new Error('Order does not match the recorded contribution.');
  const unit = units[0];
  if ((unit.custom_id !== `tc:${intent.id}` && !(intent.product?.legacy === true && intent.account_provider === 'steam' && unit.custom_id === intent.account_id)) || unit.amount?.currency_code !== intent.currency || moneyToMinor(unit.amount?.value, intent.currency) !== Number(intent.amount_minor)) throw new Error('Order account binding or amount does not match.');
  return unit;
}
export function verifiedCapture(order, intent, { allowAdjusted = false } = {}) {
  const unit = verifyOrderPayment(order, intent);
  const captures = unit.payments?.captures || [];
  if (captures.length !== 1) throw new Error('A single verified capture is required.');
  const capture = captures[0];
  if (capture.status !== 'COMPLETED' && !(allowAdjusted && ['REFUNDED','PARTIALLY_REFUNDED','REVERSED'].includes(capture.status))) return null;
  if (!capture.id || capture.amount?.currency_code !== intent.currency || moneyToMinor(capture.amount.value, intent.currency) !== Number(intent.amount_minor)) throw new Error('Capture amount does not match.');
  return { id: capture.id, amountMinor: Number(intent.amount_minor), currency: intent.currency, paidAt: capture.create_time || new Date().toISOString() };
}
