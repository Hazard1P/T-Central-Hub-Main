import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getGoogleAuthBaseUrl, shouldUseSecureGoogleCookie } from '@/lib/googleAuthUrl';

function normalizeRedirectPath(value) {
  const raw = String(value || '').trim();
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//')) return '/';
  return raw;
}

export async function GET(request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID is required.' }, { status: 500 });
  }

  const baseUrl = getGoogleAuthBaseUrl();
  const requestUrl = new URL(request.url);
  const redirectPath = normalizeRedirectPath(requestUrl.searchParams.get('redirectTo'));
  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  const state = crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    prompt: 'select_account',
    state,
  });

  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  response.cookies.set({
    name: 'google_auth_state',
    value: state,
    httpOnly: true,
    secure: shouldUseSecureGoogleCookie(baseUrl),
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });
  response.cookies.set({
    name: 'google_auth_return_to',
    value: redirectPath,
    httpOnly: true,
    secure: shouldUseSecureGoogleCookie(baseUrl),
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });

  return response;
}
