import { NextResponse } from 'next/server';
import { getGoogleAuthBaseUrl, shouldUseSecureGoogleCookie } from '@/lib/googleAuthUrl';

export async function GET(request) {
  const baseUrl = getGoogleAuthBaseUrl();
  const secure = shouldUseSecureGoogleCookie(baseUrl);
  const url = new URL(request.url);
  const redirectUrl = new URL('/', url.origin);
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set({
    name: 'google_session',
    value: '',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
