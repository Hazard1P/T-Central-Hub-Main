import { NextResponse } from 'next/server';
import { getSteamAuthBaseUrl } from '@/lib/steamAuthUrl';

export const dynamic = 'force-dynamic';
export async function GET() {
  let steam = false;
  try { getSteamAuthBaseUrl(); steam = Boolean(process.env.SESSION_SECRET || process.env.NODE_ENV !== 'production'); } catch {}
  const google = steam && Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return NextResponse.json({ steam, google }, { headers: { 'Cache-Control': 'private, no-store' } });
}
