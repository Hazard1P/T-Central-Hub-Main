import { getPayPalAccessToken, getPayPalBaseUrl, getPayPalSubscriptionPlanId, isPayPalSubscriptionConfigured } from '@/lib/paypal';
import { publicMonthlyPlan } from '@/lib/supportPlan';
let saved = null;
export async function monthlySupportPlan() {
  const id = getPayPalSubscriptionPlanId();
  if (!isPayPalSubscriptionConfigured()) return null;
  if (saved?.id === id && Date.now() - saved.at < 60000) return saved.value;
  const token = await getPayPalAccessToken();
  const response = await fetch(`${getPayPalBaseUrl()}/v1/billing/plans/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(6000) });
  const value = response.ok ? publicMonthlyPlan(await response.json()) : null;
  saved = { id, at: Date.now(), value };
  return value;
}
