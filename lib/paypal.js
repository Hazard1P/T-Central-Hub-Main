import { getRequestBaseUrl } from '@/lib/runtimeConfig';

const PAYPAL_API_BASE = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
};

export function getPayPalEnv() {
  return (process.env.PAYPAL_ENV || 'sandbox').toLowerCase() === 'live' ? 'live' : 'sandbox';
}

export function getPayPalBaseUrl() {
  return PAYPAL_API_BASE[getPayPalEnv()];
}

export function getPayPalClientId() {
  return process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';
}

export function getPayPalCurrency() {
  return process.env.PAYPAL_CURRENCY || 'USD';
}

export function getPayPalSubscriptionPlanId() {
  return process.env.PAYPAL_SUBSCRIPTION_PLAN_ID || '';
}

export function isPayPalConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export function isPayPalSubscriptionConfigured() {
  return Boolean(isPayPalConfigured() && getPayPalSubscriptionPlanId());
}

export async function getPayPalAccessToken() {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !secret) {
    throw new Error('PayPal is not configured');
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`PayPal auth failed (${response.status})`);
  }

  const data = await response.json();
  return data.access_token;
}

export async function createPayPalOrder({ request, amount, currency, steamUser, anchorSlug, solarSystemKey }) {
  const accessToken = await getPayPalAccessToken();
  const baseUrl = getRequestBaseUrl(request);
  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: `${anchorSlug || 'hub'}:${solarSystemKey || 'solar_system'}:${steamUser.steamid}`,
        description: `T-Central support for ${steamUser.personaname || steamUser.steamid}`,
        custom_id: steamUser.steamid,
        soft_descriptor: 'TCENTRAL HUB',
        amount: {
          currency_code: currency,
          value: amount,
        },
      },
    ],
    application_context: {
      brand_name: 'T-Central Hub',
      user_action: 'PAY_NOW',
      return_url: `${baseUrl}/donate?paypal=approved`,
      cancel_url: `${baseUrl}/donate?paypal=cancelled`,
      shipping_preference: 'NO_SHIPPING',
    },
  };

  const response = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || `PayPal create order failed (${response.status})`);
  }

  return data;
}

export async function capturePayPalOrder(orderId) {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || `PayPal capture failed (${response.status})`);
  }

  return data;
}

async function getPayPalJson(path) {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${getPayPalBaseUrl()}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || `PayPal request failed (${response.status})`);
  }
  return data;
}

export async function getPayPalOrderDetails(orderId) {
  if (!orderId) {
    throw new Error('Missing PayPal order ID');
  }
  return getPayPalJson(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
}

export async function getPayPalCaptureDetails(captureId) {
  if (!captureId) {
    throw new Error('Missing PayPal capture ID');
  }
  return getPayPalJson(`/v2/payments/captures/${encodeURIComponent(captureId)}`);
}

export async function getPayPalSubscriptionDetails(subscriptionId) {
  if (!subscriptionId) {
    throw new Error('Missing PayPal subscription ID');
  }
  return getPayPalJson(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

export async function verifyPayPalWebhook({ request, bodyText }) {
  const accessToken = await getPayPalAccessToken();
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    throw new Error('PAYPAL_WEBHOOK_ID is missing');
  }

  const headers = request.headers;
  const payload = {
    auth_algo: headers.get('paypal-auth-algo'),
    cert_url: headers.get('paypal-cert-url'),
    transmission_id: headers.get('paypal-transmission-id'),
    transmission_sig: headers.get('paypal-transmission-sig'),
    transmission_time: headers.get('paypal-transmission-time'),
    webhook_id: webhookId,
    webhook_event: JSON.parse(bodyText),
  };

  const response = await fetch(`${getPayPalBaseUrl()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));
  return data?.verification_status === 'SUCCESS';
}
