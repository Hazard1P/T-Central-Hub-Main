import { resolveOperationsAdmin } from "@/lib/auth/resolveOperationsAdmin";
import { readJsonBounded } from "@/lib/server/requestSecurity";
import { NextResponse } from "next/server";
import {
  getGatewayStatus,
  migrateIntoGame,
} from "@/lib/integrations/standaloneBlackholeGateway";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const access = await resolveOperationsAdmin(request);
  if (!access.authorized)
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status },
    );
  return NextResponse.json(getGatewayStatus());
}

export async function POST(request) {
  const access = await resolveOperationsAdmin(request);
  if (!access.authorized)
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status },
    );
  const body = await readJsonBounded(request).catch(() => ({}));
  const result = migrateIntoGame({
    payload: body?.payload || {},
    payloadType: body?.payloadType,
    entryVector: body?.entryVector,
    exitVector: body?.exitVector,
    requestedBy: body?.requestedBy || "api",
  });

  const status = result.ok ? 200 : 422;
  return NextResponse.json(result, { status });
}
