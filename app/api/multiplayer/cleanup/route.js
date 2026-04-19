export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cleanupDurableRoom, hasDurableMultiplayer } from '@/lib/durableMultiplayerStore';

export async function GET(request) {
  const auth = request.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && auth !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (!hasDurableMultiplayer()) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const result = await cleanupDurableRoom({ roomName: process.env.NEXT_PUBLIC_MULTIPLAYER_ROOM || 'tcentral-main' });
  return NextResponse.json(result, { status: result.status || 200 });
}
