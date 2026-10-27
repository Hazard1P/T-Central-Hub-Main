import { resolveOperationsAdmin } from "@/lib/auth/resolveOperationsAdmin";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import {
  cleanupDurableRoom,
  hasDurableMultiplayer,
} from "@/lib/durableMultiplayerStore";

export async function GET(request) {
  const access = await resolveOperationsAdmin(request);
  if (!access.authorized)
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status },
    );
  if (!hasDurableMultiplayer()) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const result = await cleanupDurableRoom({
    roomName: process.env.NEXT_PUBLIC_MULTIPLAYER_ROOM || "tcentral-main",
  });
  return NextResponse.json(result, { status: result.status || 200 });
}
