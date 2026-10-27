import { readJsonBounded } from "@/lib/server/requestSecurity";
import { moderation } from "@/lib/server/moderationStore";
import { banDenial } from "@/lib/moderation";
import {
  hasRealtimeServer,
  realtimeCall,
  requiresRealtimeServer,
} from "@/lib/server/realtimeBridge";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveGameAuthContext } from "@/lib/auth/resolveGameAuthContext";
import { resolveGuestPilotSession } from "@/lib/guestPilotIdentity";
import { isSameOriginPaymentRequest } from "@/lib/paymentRequest";
import { getAuthoritativeState } from "@/lib/authoritativeMultiplayerStore";
import {
  hasDurableMultiplayer,
  getDurableState,
} from "@/lib/durableMultiplayerStore";
import { getShipEconomyStore } from "@/lib/server/shipEconomyStore";
import {
  economyLocation,
  miningTarget,
  MINING_RANGE,
  shipStats,
} from "@/lib/shipEconomy";

export const dynamic = "force-dynamic";
const reply = (body, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function POST(request) {
  if (!isSameOriginPaymentRequest(request))
    return reply({ ok: false, error: "Same-origin requests required." }, 403);
  if (!hasRealtimeServer() && requiresRealtimeServer())
    return reply(
      {
        ok: false,
        error:
          "Real-time flight is being configured. Rejoin when the game server is available.",
      },
      503,
    );
  const body = await readJsonBounded(request).catch(() => null);
  if (
    !body ||
    typeof body.roomName !== "string" ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(body.roomName) ||
    typeof body.token !== "string" ||
    body.token.length < 16 ||
    body.token.length > 256 ||
    !["state", "mine", "deliver", "upgrade"].includes(body.action)
  )
    return reply({ ok: false, error: "Invalid flight request." }, 400);
  if (body.action !== "state" && !/^[a-f0-9-]{36}$/.test(body.requestId || ""))
    return reply({ ok: false, error: "Invalid action receipt." }, 400);
  const cookieStore = await cookies(),
    auth = resolveGameAuthContext(cookieStore);
  const guest = auth.authenticated
    ? null
    : resolveGuestPilotSession(cookieStore.get("tcentral_guest_pilot")?.value);
  const owner = auth.authenticated
    ? auth.provider + ":" + auth.accountId
    : guest.id;
  if (body.id !== owner || guest?.setCookie)
    return reply(
      { ok: false, error: "Your account changed. Rejoin the shared flight." },
      401,
    );
  const access = banDenial(await moderation().access([owner]), owner);
  if (!access.ok) return reply(access, access.status);
  try {
    const args = { roomName: body.roomName, id: owner, token: body.token };
    const state = hasRealtimeServer()
      ? await realtimeCall("state", args)
      : hasDurableMultiplayer()
        ? await getDurableState(args)
        : getAuthoritativeState(args);
    if (!state.ok)
      return reply(
        { ok: false, error: "Rejoin a shared flight to use your shipyard." },
        401,
      );
    const player = state.state.players.find((entry) => entry.id === owner);
    if (!player)
      return reply({ ok: false, error: "Pilot session is unavailable." }, 401);
    if (player.alive === false && body.action !== "state")
      return reply(
        { ok: false, error: "Ship disabled. Wait for your Earth respawn." },
        409,
      );
    const now = Date.now(),
      physicsUtcMs = Number.isFinite(state.state.physicsUtcMs)
        ? state.state.physicsUtcMs
        : now;
    const location = economyLocation(player, physicsUtcMs);
    const command = {
      action: body.action,
      atEarth: location.atEarth,
      slow: location.slow,
    };
    if (body.action === "mine")
      command.asteroid = miningTarget(
        player,
        { asteroid: body.asteroid, direction: body.direction },
        physicsUtcMs,
      ).id;
    if (body.action === "upgrade") {
      command.upgrade = body.upgrade;
      command.expectedLevel = body.expectedLevel;
    }
    const result = await getShipEconomyStore().run({
      owner,
      room: body.roomName,
      token: body.token,
      requestId: body.requestId,
      command,
      now,
    });
    const available = location.rocks
      .filter(
        (rock) =>
          !(
            result.rocks[rock.id]?.hp === 0 &&
            result.rocks[rock.id].depleted_until > now
          ),
      )
      .map((rock) => ({
        ...rock,
        distance:
          Math.hypot(...rock.position.map((v, i) => v - player.position[i])) -
          rock.radius,
      }))
      .sort((a, b) => a.distance - b.distance);
    location.nearest = available[0] || location.nearest;
    return reply({
      ok: true,
      ...result,
      stats: shipStats(result.wallet),
      accountBound: auth.authenticated,
      serverTime: now,
      location: {
        atEarth: location.atEarth,
        slow: location.slow,
        speed: location.speed,
        nearest: {
          id: location.nearest.id,
          label: location.nearest.label,
          distance: Math.max(0, location.nearest.distance),
        },
        canMine:
          player.alive !== false &&
          location.nearest.distance <= MINING_RANGE &&
          location.speed <= 25,
      },
    });
  } catch (error) {
    const unavailable = /database configuration|storage is unavailable/i.test(
      error.message,
    );
    return reply(
      {
        ok: false,
        error: unavailable
          ? "Ship economy is being configured. Free flight is available."
          : error.message,
      },
      unavailable ? 503 : 409,
    );
  }
}
