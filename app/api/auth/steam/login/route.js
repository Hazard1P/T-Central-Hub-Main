import { NextResponse } from 'next/server';
import { getSteamAuthBaseUrl } from '@/lib/steamAuthUrl';

export async function GET() {
  let baseUrl;

  try {
    baseUrl = getSteamAuthBaseUrl();
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const returnTo = `${baseUrl}/api/auth/steam/callback`;

  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': baseUrl,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });

  return NextResponse.redirect(`https://steamcommunity.com/openid/login?${params.toString()}`);
}
