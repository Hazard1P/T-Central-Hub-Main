import { readJsonBounded } from "@/lib/server/requestSecurity";
import { hasRealtimeServer, realtimeCall } from "@/lib/server/realtimeBridge";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import {
  disconnectDurablePlayer,
  hasDurableMultiplayer,
} from "@/lib/durableMultiplayerStore";
import { disconnectAuthoritativePlayer } from "@/lib/authoritativeMultiplayerStore";

export async function POST(request) {
  const body = await readJsonBounded(request).catch(() => ({}));
  if (hasRealtimeServer()) {
    const result = await realtimeCall("disconnect", body);
    return NextResponse.json(result, { status: result.status || 200 });
  }
  const disconnect = hasDurableMultiplayer()
    ? disconnectDurablePlayer
    : disconnectAuthoritativePlayer;
  const result = await disconnect({
    roomName: body?.roomName,
    id: body?.id,
    token: body?.token,
  });
  return NextResponse.json(result, { status: result.status || 200 });
}
