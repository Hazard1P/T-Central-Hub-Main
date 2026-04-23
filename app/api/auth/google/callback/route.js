import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { encryptJson } from '@/lib/security';
import { getGoogleAuthBaseUrl, shouldUseSecureGoogleCookie } from '@/lib/googleAuthUrl';

function normalizeRedirectPath(value) {
  const raw = String(value || '').trim();
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//')) return '/';
  return raw;
}

function clearTransientCookies(response, secure) {
  response.cookies.set({ name: 'google_auth_state', value: '', httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 0 });
  response.cookies.set({ name: 'google_auth_return_to', value: '', httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 0 });
}

export async function GET(request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required.' }, { status: 500 });
  }

  const baseUrl = getGoogleAuthBaseUrl();
  const secure = shouldUseSecureGoogleCookie(baseUrl);
  const cookieStore = cookies();
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const stateCookie = cookieStore.get('google_auth_state')?.value;

  const returnPath = normalizeRedirectPath(cookieStore.get('google_auth_return_to')?.value);
  const redirectUrl = new URL(returnPath, baseUrl);

  if (!code || !state || !stateCookie || state !== stateCookie) {
    redirectUrl.searchParams.set('google', 'invalid_state');
    const response = NextResponse.redirect(redirectUrl);
    clearTransientCookies(response, secure);
    return response;
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${baseUrl}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }).toString(),
      cache: 'no-store',
    });

    if (!tokenRes.ok) {
      redirectUrl.searchParams.set('google', 'token_error');
      const response = NextResponse.redirect(redirectUrl);
      clearTransientCookies(response, secure);
      return response;
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData?.access_token;
    if (!accessToken) {
      redirectUrl.searchParams.set('google', 'token_missing');
      const response = NextResponse.redirect(redirectUrl);
      clearTransientCookies(response, secure);
      return response;
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });

    if (!userRes.ok) {
      redirectUrl.searchParams.set('google', 'profile_error');
      const response = NextResponse.redirect(redirectUrl);
      clearTransientCookies(response, secure);
      return response;
    }

    const profile = await userRes.json();
    const user = {
      sub: profile.sub,
      name: profile.name,
      email: profile.email,
      picture: profile.picture,
      email_verified: Boolean(profile.email_verified),
    };

    redirectUrl.searchParams.set('google', 'linked');
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set({
      name: 'google_session',
      value: encryptJson(user),
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    clearTransientCookies(response, secure);
    return response;
  } catch {
    redirectUrl.searchParams.set('google', 'oauth_error');
    const response = NextResponse.redirect(redirectUrl);
    clearTransientCookies(response, secure);
    return response;
  }
}
