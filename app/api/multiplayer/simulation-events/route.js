export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { hasDurableMultiplayer, listSimulationEvents } from '@/lib/durableMultiplayerStore';
import { awardMultiplayerProgressionEvent } from '@/lib/multiplayerProgression';

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

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const trigger = body?.trigger;
  const result = await awardMultiplayerProgressionEvent({
    playerId: body?.playerId,
    roomName: body?.roomName,
    eventId: body?.eventId,
    trigger,
    sessionId: body?.sessionId,
    displayName: body?.displayName,
  });

  return NextResponse.json({
    ok: result.ok,
    progressionDelta: result.delta,
    progressionSnapshot: result.snapshot,
    storage: result.storage || 'none',
    warning: result.warning || null,
    error: result.error || null,
  }, { status: result.status || (result.ok ? 200 : 422) });
}
