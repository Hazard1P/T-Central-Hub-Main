import { resolveOperationsAdmin } from "@/lib/auth/resolveOperationsAdmin";
import { readJsonBounded } from "@/lib/server/requestSecurity";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import {
  hasDurableMultiplayer,
  runSymmetryValidator,
} from "@/lib/durableMultiplayerStore";

async function handle(request, payload = {}) {
  if (!(await resolveOperationsAdmin(request)).authorized) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  if (!hasDurableMultiplayer()) {
    return NextResponse.json(
      { ok: false, error: "DURABLE_MULTIPLAYER_UNAVAILABLE" },
      { status: 503 },
    );
  }

  const result = await runSymmetryValidator({
    roomName: payload?.roomName,
    fromTimestamp: payload?.from,
    toTimestamp: payload?.to,
    limit: payload?.limit,
    strictMode: payload?.strictMode === true || payload?.strictMode === "true",
    minCoverage: payload?.minCoverage,
  });

  return NextResponse.json(result, { status: result.status || 200 });
}

export async function GET(request) {
  const access = await resolveOperationsAdmin(request);
  if (!access.authorized)
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status },
    );
  const { searchParams } = new URL(request.url);
  return handle(request, {
    roomName: searchParams.get("roomName") || undefined,
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
    limit: searchParams.get("limit") || undefined,
    strictMode: searchParams.get("strictMode") || undefined,
    minCoverage: searchParams.get("minCoverage") || undefined,
  });
}

export async function POST(request) {
  const access = await resolveOperationsAdmin(request);
  if (!access.authorized)
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status },
    );
  const body = await readJsonBounded(request).catch(() => ({}));
  return handle(request, body || {});
}
