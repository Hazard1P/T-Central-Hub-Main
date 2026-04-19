import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decryptJson } from '@/lib/security';
import { getModerationSummary } from '@/lib/serverPersistence';

export async function GET() {
  const cookieStore = cookies();
  const raw = cookieStore.get('steam_session')?.value;
  let reporter = null;
  try {
    reporter = raw ? decryptJson(raw) : null;
  } catch {
    reporter = null;
  }

  const summary = await getModerationSummary({
    reporterId: reporter?.steamid || null,
    reporterName: reporter?.personaname || 'Guest reporter',
  });

  return NextResponse.json({ ok: true, summary });
}
