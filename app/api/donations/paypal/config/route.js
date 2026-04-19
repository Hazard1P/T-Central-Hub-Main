import { NextResponse } from 'next/server';
import { getPayPalClientId, getPayPalCurrency, isPayPalConfigured } from '@/lib/paypal';

export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: isPayPalConfigured(),
    clientId: getPayPalClientId(),
    currency: getPayPalCurrency().toUpperCase(),
  });
}
