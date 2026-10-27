import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveGameAuthContext } from "@/lib/auth/resolveGameAuthContext";
import { resolveAccountUsername } from "@/lib/server/accountUsernameStore";
import {
  verifiedProgressIdentity,
  mergeClientDiscoveries,
} from "@/lib/server/accountProgressionPolicy";
import {
  buildAccountSnapshot,
  defaultProgressState,
  normalizeProgressState,
} from "@/lib/accountProgression";
import {
  loadPlayerProgression,
  persistPlayerProgression,
} from "@/lib/serverPersistence";
import { isSameOriginPaymentRequest } from "@/lib/paymentRequest";
import { readJsonBounded } from "@/lib/server/requestSecurity";
export const dynamic = "force-dynamic";
const reply = (body, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
async function identity() {
  return verifiedProgressIdentity(
    await resolveAccountUsername(resolveGameAuthContext(await cookies())),
  );
}
export async function GET() {
  try {
    const owner = await identity(),
      loaded = await loadPlayerProgression(owner);
    if (!loaded.ok)
      throw Object.assign(
        new Error("Account progress storage is unavailable."),
        { status: 503 },
      );
    const snapshot = buildAccountSnapshot({
      identity: owner,
      progress: loaded?.record
        ? normalizeProgressState(loaded.record.progress)
        : defaultProgressState(),
      savedAt: loaded?.record?.savedAt,
    });
    return reply({
      ok: true,
      snapshot,
      storage: loaded?.storage || "local-default",
    });
  } catch (error) {
    return reply(
      {
        ok: false,
        error: error.status
          ? error.message
          : "Account progress is unavailable.",
      },
      error.status || 503,
    );
  }
}
export async function POST(request) {
  if (!isSameOriginPaymentRequest(request))
    return reply({ ok: false, error: "Same-origin requests required." }, 403);
  try {
    const owner = await identity(),
      body = await readJsonBounded(request, 32768),
      loaded = await loadPlayerProgression(owner);
    if (!loaded.ok)
      throw Object.assign(
        new Error("Account progress storage is unavailable."),
        { status: 503 },
      );
    const progress = mergeClientDiscoveries(
        loaded?.record?.progress,
        body?.progress,
      ),
      snapshot = buildAccountSnapshot({ identity: owner, progress });
    const saved = await persistPlayerProgression(snapshot, {
      eventType: "PROGRESSION_SNAPSHOT_SAVED",
      ledgerMetadata: {
        provider: owner.kind,
        source: "authenticated_discoveries_api",
      },
    });
    return reply(
      { ok: saved.ok, snapshot, storage: saved.storage },
      saved.ok ? 200 : 503,
    );
  } catch (error) {
    return reply(
      {
        ok: false,
        error: error.status
          ? error.message
          : "Account progress is unavailable.",
      },
      error.status || 503,
    );
  }
}
