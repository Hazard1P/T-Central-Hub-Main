import { NextResponse } from 'next/server';
import { getSteamAuthBaseUrl, shouldUseSecureSteamCookie } from '@/lib/steamAuthUrl';

function normalizeRedirectPath(value) {
  const raw = String(value || '').trim();
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//')) return '/';
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
  const redirectPath = normalizeRedirectPath(requestUrl.searchParams.get('redirectTo'));
  const returnTo = `${baseUrl}/api/auth/steam/callback`;

  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': baseUrl,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });

  const response = NextResponse.redirect(`https://steamcommunity.com/openid/login?${params.toString()}`);
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
