export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { disconnectDurablePlayer, hasDurableMultiplayer } from '@/lib/durableMultiplayerStore';

export async function POST(request) {
  if (!hasDurableMultiplayer()) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const body = await request.json().catch(() => ({}));
  const result = await disconnectDurablePlayer({
    roomName: body?.roomName,
    id: body?.id,
    token: body?.token,
  });
  return NextResponse.json(result, { status: result.status || 200 });
}
