import { readJsonBounded } from "@/lib/server/requestSecurity";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveGameAuthContext } from "@/lib/auth/resolveGameAuthContext";
import { getPrayerSeedStore } from "@/lib/server/prayerSeedStore";
import {
  getSeedOwner,
  validateSeedInput,
} from "@/lib/server/prayerSeedRecords";
import {
  parsePrayerSeedVault,
  PRAYER_SEED_COOKIE,
} from "@/lib/universeApiStore";
import { createPrivacySummary } from "@/lib/universePrivacyEngine";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const failure = (error) =>
  NextResponse.json(
    {
      ok: false,
      error: error.status
        ? error.message
        : "Seed storage is unavailable. Please try again later.",
    },
    { status: error.status || 503, headers },
  );

async function authenticate() {
  const auth = resolveGameAuthContext(await cookies());
  getSeedOwner(auth);
  if (process.env.UNIVERSE_API_ENABLED === "false")
    throw Object.assign(
      new Error("Prayer Seeds are temporarily unavailable."),
      { status: 503 },
    );
  return auth;
}

export async function GET() {
  try {
    const auth = await authenticate();
    // Recover old encrypted cookies only for their verified Steam owner. Keep other accounts' entries intact.
    const old = parsePrayerSeedVault(
      (await cookies()).get(PRAYER_SEED_COOKIE)?.value,
    );
    const scope = createPrivacySummary({
      authContext: auth,
      lobbyMode: "private",
    }).storageKey;
    for (const seed of old.slice(0, 40)) {
      if (
        auth.provider !== "steam" ||
        String(seed.plantedBy?.steamid) !== auth.accountId ||
        seed.scope !== scope ||
        typeof seed.body !== "string" ||
        !seed.body.trim()
      )
        continue;
      const time = Date.parse(seed.plantedAt);
      if (!Number.isFinite(time) || !/^[a-zA-Z0-9_-]{1,60}$/.test(seed.id))
        continue;
      await getPrayerSeedStore().save(
        auth,
        {
          body: seed.body.trim().slice(0, 320),
          requestId: "legacy-" + seed.id,
          flightSignature: "legacy-cookie",
        },
        { now: time, legacy: true },
      );
    }
    return NextResponse.json(
      { ok: true, ...(await getPrayerSeedStore().load(auth)) },
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request) {
  try {
    const auth = await authenticate();
    const origin = request.headers.get("origin");
    // Next may normalize request.url to localhost behind a proxy; the HTTP Host retains the browser's host.
    let sameOrigin = !origin;
    try {
      if (origin) {
        const parsed = new URL(origin);
        sameOrigin =
          ["http:", "https:"].includes(parsed.protocol) &&
          parsed.host ===
            (request.headers.get("host") || new URL(request.url).host);
      }
    } catch {
      sameOrigin = false;
    }
    if (!sameOrigin)
      return NextResponse.json(
        { ok: false, error: "Use your own account session to leave a seed." },
        { status: 403, headers },
      );
    if (Number(request.headers.get("content-length")) > 8192)
      return NextResponse.json(
        { ok: false, error: "This seed is too large." },
        { status: 413, headers },
      );
    const input = validateSeedInput(
      await readJsonBounded(request).catch(() => null),
    );
    const result = await getPrayerSeedStore().save(auth, input);
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (error) {
    return failure(error);
  }
}
