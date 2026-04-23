export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { applyAuthoritativeAction, pruneAuthoritativeRooms } from '@/lib/authoritativeMultiplayerStore';
import { applyDurableAction, hasDurableMultiplayer } from '@/lib/durableMultiplayerStore';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  if (hasDurableMultiplayer()) {
    const result = await applyDurableAction({
      roomName: body?.roomName,
      id: body?.id,
      token: body?.token,
      action: body?.action,
      captureSimulationEvent: body?.captureSimulationEvent !== false,
    });
    return NextResponse.json(result, { status: result.status || 200 });
  }

  pruneAuthoritativeRooms();
  const result = applyAuthoritativeAction({
    roomName: body?.roomName,
    id: body?.id,
    token: body?.token,
    action: body?.action,
  });
  return NextResponse.json({ ...result, durable: false }, { status: result.status || 200 });
}
