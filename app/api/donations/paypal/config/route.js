import { getPayPalEnv, getPayPalClientId, getPayPalCurrency, getPayPalSubscriptionPlanId, isPayPalConfigured } from '@/lib/paypal';
import { monthlySupportPlan } from '@/lib/server/monthlySupportPlan';
export const dynamic = 'force-dynamic';
export async function GET() {
  const monthlyPlan = await monthlySupportPlan().catch(() => null);
  return Response.json({ ok: true, environment: getPayPalEnv(), configured: isPayPalConfigured(), clientId: getPayPalClientId(), currency: getPayPalCurrency().toUpperCase(), subscriptionEnabled: Boolean(monthlyPlan), monthlyPlan, subscriptionPlanId: getPayPalSubscriptionPlanId() || null });
}
