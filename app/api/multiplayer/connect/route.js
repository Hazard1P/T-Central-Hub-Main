export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { joinAuthoritativeRoom, pruneAuthoritativeRooms } from '@/lib/authoritativeMultiplayerStore';
import { hasDurableMultiplayer, joinDurableRoom } from '@/lib/durableMultiplayerStore';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  if (hasDurableMultiplayer()) {
    const result = await joinDurableRoom({
      roomName: body?.roomName,
      identity: body?.identity,
      steamUser: body?.steamUser,
    });
    return NextResponse.json(result, { status: result.status || 200 });
  }

  pruneAuthoritativeRooms();
  const result = joinAuthoritativeRoom({
    roomName: body?.roomName,
    identity: body?.identity,
    steamUser: body?.steamUser,
  });
  return NextResponse.json({ ...result, durable: false });
}
