export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { hasDurableMultiplayer, listSimulationEvents } from '@/lib/durableMultiplayerStore';

export async function GET(request) {
  if (!hasDurableMultiplayer()) {
    return NextResponse.json({ ok: false, error: 'DURABLE_MULTIPLAYER_UNAVAILABLE' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const result = await listSimulationEvents({
    roomName: searchParams.get('roomName') || undefined,
    playerId: searchParams.get('playerId') || undefined,
    sessionId: searchParams.get('sessionId') || undefined,
    fromTimestamp: searchParams.get('from') || undefined,
    toTimestamp: searchParams.get('to') || undefined,
    limit: searchParams.get('limit') || undefined,
  });

  return NextResponse.json(result, { status: result.status || 200 });
}
