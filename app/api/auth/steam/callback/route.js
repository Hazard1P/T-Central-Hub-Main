import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { encryptJson } from '@/lib/security';
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

  const url = new URL(request.url);
  const params = url.searchParams;

  const verify = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    verify.set(key, value);
  }
  verify.set('openid.mode', 'check_authentication');

  const verifyRes = await fetch('https://steamcommunity.com/openid/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: verify.toString(),
    cache: 'no-store',
  });

  const verifyText = await verifyRes.text();
  const valid = verifyRes.ok && verifyText.includes('is_valid:true');

  const cookieStore = cookies();
  const returnPath = normalizeRedirectPath(cookieStore.get('steam_auth_return_to')?.value);
  const redirectUrl = new URL(returnPath, baseUrl);

  if (!valid) {
    redirectUrl.searchParams.set('steam', 'invalid');
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set({
      name: 'steam_auth_return_to',
      value: '',
      httpOnly: true,
      secure: shouldUseSecureSteamCookie(baseUrl),
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  }

  const claimedId = params.get('openid.claimed_id') || '';
  const match = claimedId.match(/\/id\/(\d+)$/);
  const steamid = match?.[1];

  if (!steamid) {
    redirectUrl.searchParams.set('steam', 'missing');
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set({
      name: 'steam_auth_return_to',
      value: '',
      httpOnly: true,
      secure: shouldUseSecureSteamCookie(baseUrl),
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  }

  let user = { steamid };
  const apiKey = process.env.STEAM_API_KEY;

  if (apiKey) {
    try {
      const profileRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamid}`,
        { cache: 'no-store' }
      );
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        const profile = profileData?.response?.players?.[0];
        if (profile) {
          user = {
            steamid,
            personaname: profile.personaname,
            profileurl: profile.profileurl,
            avatar: profile.avatarfull || profile.avatarmedium || profile.avatar,
          };
        }
      }
    } catch {
      // fall back to steamid-only session
    }
  }

  redirectUrl.searchParams.set('steam', 'linked');
  const response = NextResponse.redirect(redirectUrl);
  const secure = shouldUseSecureSteamCookie(baseUrl);
  response.cookies.set({
    name: 'steam_session',
    value: encryptJson(user),
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  response.cookies.set({
    name: 'steam_auth_return_to',
    value: '',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
