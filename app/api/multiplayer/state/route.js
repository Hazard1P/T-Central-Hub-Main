export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthoritativeState, updateAuthoritativePlayer, pruneAuthoritativeRooms } from '@/lib/authoritativeMultiplayerStore';
import { getDurableState, hasDurableMultiplayer, updateDurablePlayer } from '@/lib/durableMultiplayerStore';

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  if (hasDurableMultiplayer()) {
    const result = await getDurableState({
      roomName: searchParams.get('roomName') || undefined,
      id: searchParams.get('id') || undefined,
      token: searchParams.get('token') || undefined,
    });
    return NextResponse.json(result, { status: result.status || 200 });
  }

  pruneAuthoritativeRooms();
  const result = getAuthoritativeState({
    roomName: searchParams.get('roomName') || undefined,
    id: searchParams.get('id') || undefined,
    token: searchParams.get('token') || undefined,
  });
  return NextResponse.json({ ...result, durable: false }, { status: result.status || 200 });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  if (hasDurableMultiplayer()) {
    const result = await updateDurablePlayer({
      roomName: body?.roomName,
      id: body?.id,
      token: body?.token,
      snapshot: body?.snapshot,
      captureSimulationEvent: body?.captureSimulationEvent !== false,
    });
    return NextResponse.json(result, { status: result.status || 200 });
  }

  pruneAuthoritativeRooms();
  const result = updateAuthoritativePlayer({
    roomName: body?.roomName,
    id: body?.id,
    token: body?.token,
    snapshot: body?.snapshot,
  });
  return NextResponse.json({ ...result, durable: false }, { status: result.status || 200 });
}
