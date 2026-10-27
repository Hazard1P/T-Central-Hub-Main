import { NextResponse } from "next/server";
import {
  readJsonBounded,
  safeSecretMatches,
} from "@/lib/server/requestSecurity";
import { signValue } from "@/lib/security";
import { resolveOperationsAdmin } from "@/lib/auth/resolveOperationsAdmin";
import { DYSON_CONTINUITY_SCHEMA_VERSION } from "@/lib/dysonContinuity";
import { restoreService } from "@/lib/continuity/restoreService";
function buildId() {
  return String(
    process.env.DYSON_BUILD_ID ||
      process.env.NEXT_BUILD_ID ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      "dev-build",
  );
}
function internal(request, { checkpointId, expectedBuildId, mode }) {
  const at = Number(request.headers.get("x-internal-restore-at")),
    supplied = request.headers.get("x-internal-restore-token");
  if (!Number.isFinite(at) || Math.abs(Date.now() - at) > 60000 || !supplied)
    return false;
  try {
    return safeSecretMatches(
      supplied,
      signValue(JSON.stringify([checkpointId, expectedBuildId, mode, at]), {
        purpose: "continuity-restore",
      }),
    );
  } catch {
    return false;
  }
}
export async function POST(request) {
  let body;
  try {
    body = await readJsonBounded(request);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: error.status || 400 },
    );
  }
  const checkpointId =
      typeof body?.checkpointId === "string" ? body.checkpointId.trim() : "",
    mode = body?.mode === "validate_only" ? "validate_only" : "apply",
    expectedBuildId = String(body?.expectedBuildId || "");
  const signed = internal(request, { checkpointId, expectedBuildId, mode }),
    access = signed
      ? { authorized: true, actor: "signed-restore-service" }
      : await resolveOperationsAdmin(request);
  if (!access.authorized)
    return NextResponse.json(
      { ok: false, error: access.error },
      { status: access.status },
    );
  if (!checkpointId || checkpointId.length > 160)
    return NextResponse.json(
      { ok: false, error: "CHECKPOINT_ID_REQUIRED" },
      { status: 400 },
    );
  if (mode === "apply" && (!expectedBuildId || expectedBuildId !== buildId()))
    return NextResponse.json(
      { ok: false, error: "BUILD_ID_MISMATCH" },
      { status: 409 },
    );
  const result = await restoreService.restore(checkpointId, {
    mode,
    actor: access.actor,
    expectedSchemaVersion: body?.expectedSchemaVersion,
  });
  return NextResponse.json(
    {
      ok: result.ok,
      restore: result,
      continuity: {
        schemaVersion: DYSON_CONTINUITY_SCHEMA_VERSION,
        buildId: buildId(),
      },
    },
    {
      status: result.ok
        ? 200
        : result.error === "CHECKPOINT_NOT_FOUND"
          ? 404
          : 409,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
