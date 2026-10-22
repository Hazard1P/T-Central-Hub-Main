import { getPayPalEnv, getPayPalClientId, getPayPalCurrency, getPayPalSubscriptionPlanId, isPayPalConfigured } from '@/lib/paypal';
import { monthlySupportPlan } from '@/lib/server/monthlySupportPlan';
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin';
import { currencyDigits } from '@/lib/accountPayments';
export const dynamic = 'force-dynamic';
export async function GET() {
  const admin = getSupabaseAdmin();
  let currency = getPayPalCurrency().toUpperCase(), validCurrency = true;
  try { currencyDigits(currency); } catch { currency = 'USD'; validCurrency = false; }
  let configured = Boolean(isPayPalConfigured() && admin && process.env.PAYPAL_WEBHOOK_ID && validCurrency && (process.env.SESSION_SECRET || process.env.NODE_ENV !== 'production'));
  if (configured) {
    try {
      const result = await admin.from('account_payment_intents').select('id').limit(1).abortSignal(AbortSignal.timeout(4000));
      configured = !result.error;
    } catch { configured = false; }
  }
  const monthlyPlan = configured ? await monthlySupportPlan().catch(() => null) : null;
  return Response.json({ ok: true, environment: getPayPalEnv(), configured, clientId: configured ? getPayPalClientId() : '', currency, subscriptionEnabled: Boolean(monthlyPlan), monthlyPlan, subscriptionPlanId: monthlyPlan ? getPayPalSubscriptionPlanId() : null }, { headers: { 'Cache-Control': 'private, no-store' } });
}
