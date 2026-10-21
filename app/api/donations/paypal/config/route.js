import { NextResponse } from 'next/server';
import {
  getPayPalClientId,
  getPayPalAccessToken,
  getPayPalBaseUrl,
  getPayPalCurrency,
  getPayPalSubscriptionPlanId,
  isPayPalConfigured,
  isPayPalSubscriptionConfigured,
} from '@/lib/paypal';

import { publicMonthlyPlan } from '@/lib/supportPlan';

let savedPlan = null;

export const dynamic = 'force-dynamic';

export async function GET() {
  const planId = getPayPalSubscriptionPlanId();
  let monthlyPlan = null;
  if (isPayPalSubscriptionConfigured()) {
    if (savedPlan?.id === planId && Date.now() - savedPlan.checkedAt < 60000) monthlyPlan = savedPlan.value;
    else {
      try {
        const token = await getPayPalAccessToken();
        const response = await fetch(`${getPayPalBaseUrl()}/v1/billing/plans/${encodeURIComponent(planId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(6000) });
        if (response.ok) monthlyPlan = publicMonthlyPlan(await response.json());
        savedPlan = { id: planId, value: monthlyPlan, checkedAt: Date.now() };
      } catch { /* Keep recurring checkout unavailable until pricing is verified. */ }
    }
  }

  return NextResponse.json({
    ok: true,
    configured: isPayPalConfigured(),
    clientId: getPayPalClientId(),
    currency: getPayPalCurrency().toUpperCase(),
    subscriptionEnabled: Boolean(monthlyPlan),
    monthlyPlan,
    subscriptionPlanId: planId || null,
  });
}
