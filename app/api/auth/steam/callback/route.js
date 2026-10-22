export const dynamic = 'force-dynamic';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { encryptJson } from '@/lib/security';
import { getSteamAuthBaseUrl, shouldUseSecureSteamCookie } from '@/lib/steamAuthUrl';
import { ensurePlayerAccountForLogin } from '@/lib/serverPersistence';

export async function GET(request) {
  let baseUrl;
  try { baseUrl = getSteamAuthBaseUrl(); }
  catch { return NextResponse.json({ error: 'Steam sign-in is being configured.' }, { status: 503 }); }
  const secure = shouldUseSecureSteamCookie(baseUrl), store = cookies();
  const raw = String(store.get('steam_auth_return_to')?.value || '/system');
  const path = raw.startsWith('/') && !raw.startsWith('//') && !/[\\\x00-\x1f\x7f]/.test(raw) ? raw : '/system';
  const redirectUrl = new URL(path, baseUrl), params = new URL(request.url).searchParams;
  const finish = (status, user = null) => {
    redirectUrl.searchParams.set('steam', status);
    const response = NextResponse.redirect(redirectUrl);
    for (const name of ['steam_auth_return_to','steam_auth_state']) response.cookies.set({ name, value: '', httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 0 });
    if (user) {
      response.cookies.set({ name: 'google_session', value: '', httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 0 });
      response.cookies.set({ name: 'steam_session', value: encryptJson(user), httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 604800 });
    }
    return response;
  };
  const state = store.get('steam_auth_state')?.value;
  const claimed = params.get('openid.claimed_id') || '';
  const signed = new Set((params.get('openid.signed') || '').split(','));
  const signedIdentity = ['op_endpoint', 'claimed_id', 'identity', 'return_to', 'response_nonce', 'assoc_handle'].every(key => signed.has(key));
  const match = claimed.match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/);
  if (!signedIdentity || !state || params.get('state') !== state || params.get('openid.return_to') !== `${baseUrl}/api/auth/steam/callback?state=${state}` || params.get('openid.mode') !== 'id_res' || params.get('openid.identity') !== claimed || !match || params.get('openid.op_endpoint') !== 'https://steamcommunity.com/openid/login') return finish('invalid');
  try {
    const verify = new URLSearchParams();
    for (const [key,value] of params) if (key.startsWith('openid.')) verify.set(key,value);
    verify.set('openid.mode','check_authentication');
    const verification = await fetch('https://steamcommunity.com/openid/login', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: verify.toString(), cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!verification.ok || !/^is_valid:true\r?$/m.test(await verification.text())) return finish('invalid');
    let user = { steamid: match[1] };
    if (process.env.STEAM_API_KEY) {
      try {
        const profileRes = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${process.env.STEAM_API_KEY}&steamids=${user.steamid}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
        if (profileRes.ok) {
          const profile = (await profileRes.json())?.response?.players?.[0];
          if (profile) user = { ...user, personaname: profile.personaname, profileurl: profile.profileurl, avatar: profile.avatarfull || profile.avatar };
        }
      } catch { /* A profile image is optional. */ }
    }
    try {
      await ensurePlayerAccountForLogin({ provider: 'steam', accountId: user.steamid, displayName: user.personaname || 'Steam Pilot', metadata: { source: 'steam_openid_callback', profileUrl: user.profileurl || null, avatarUrl: user.avatar || null } });
    } catch { /* Verified login survives unavailable account bootstrap storage. */ }
    return finish('linked', user);
  } catch { return finish('unavailable'); }
}
