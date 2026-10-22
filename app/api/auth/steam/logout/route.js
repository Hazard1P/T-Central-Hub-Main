export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getRequestBaseUrl, shouldUseSecureCookies } from '@/lib/runtimeConfig';

export async function GET(request) {
  const response = NextResponse.redirect(new URL('/', getRequestBaseUrl(request)));
  response.cookies.set({
    name: 'steam_session', value: '', httpOnly: true,
    secure: shouldUseSecureCookies(request), sameSite: 'lax', path: '/', maxAge: 0,
  });
  return response;
}
