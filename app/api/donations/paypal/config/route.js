import { NextResponse } from 'next/server';
import {
  getPayPalClientId,
  getPayPalCurrency,
  getPayPalSubscriptionPlanId,
  isPayPalConfigured,
  isPayPalSubscriptionConfigured,
} from '@/lib/paypal';

export async function GET() {
  const planId = getPayPalSubscriptionPlanId();

  return NextResponse.json({
    ok: true,
    configured: isPayPalConfigured(),
    clientId: getPayPalClientId(),
    currency: getPayPalCurrency().toUpperCase(),
    subscriptionEnabled: isPayPalSubscriptionConfigured(),
    subscriptionPlanId: planId || null,
  });
}
