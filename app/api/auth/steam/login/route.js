export const dynamic = 'force-dynamic';
import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSteamAuthBaseUrl, shouldUseSecureSteamCookie } from '@/lib/steamAuthUrl';

function normalizeRedirectPath(value) {
  const raw = String(value || '').trim();
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//') || /[\\\x00-\x1f\x7f]/.test(raw)) return '/';
  return raw;
}

export async function GET(request) {
  let baseUrl;

  try {
    baseUrl = getSteamAuthBaseUrl();
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const requestUrl = new URL(request.url);
  const requestHost = (request.headers.get('x-forwarded-host') || request.headers.get('host') || requestUrl.host).split(',')[0].trim().toLowerCase();
  if (requestHost !== new URL(baseUrl).host.toLowerCase()) {
    const canonical = new URL(requestUrl.pathname + requestUrl.search, baseUrl);
    return NextResponse.redirect(canonical);
  }

  const redirectPath = normalizeRedirectPath(requestUrl.searchParams.get('redirectTo'));
  const state = randomBytes(24).toString('hex');
  const returnTo = `${baseUrl}/api/auth/steam/callback?state=${state}`;

  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': baseUrl,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });

  const response = NextResponse.redirect(`https://steamcommunity.com/openid/login?${params.toString()}`);
  response.cookies.set({ name: 'steam_auth_state', value: state, httpOnly: true, secure: shouldUseSecureSteamCookie(baseUrl), sameSite: 'lax', path: '/', maxAge: 600 });
  response.cookies.set({
    name: 'steam_auth_return_to',
    value: redirectPath,
    httpOnly: true,
    secure: shouldUseSecureSteamCookie(baseUrl),
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });

  return response;
}
