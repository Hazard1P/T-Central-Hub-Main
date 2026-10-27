import { signFlightTicket } from "../realtime/tickets.js";
import { PHYSICS_VERSION } from "../physics/mechanics.js";
export function hasRealtimeServer() {
  try {
    const service = new URL(process.env.REALTIME_SERVER_URL),
      socket = new URL(process.env.NEXT_PUBLIC_REALTIME_WS_URL);
    return (
      ["http:", "https:"].includes(service.protocol) &&
      ["ws:", "wss:"].includes(socket.protocol) &&
      !(
        process.env.NODE_ENV === "production" &&
        socket.protocol !== "wss:" &&
        !["localhost", "127.0.0.1", "[::1]"].includes(socket.hostname)
      ) &&
      !service.username &&
      !service.password &&
      !socket.username &&
      !socket.password &&
      Boolean(process.env.REALTIME_SERVER_SECRET?.length >= 32)
    );
  } catch {
    return false;
  }
}
export function realtimeTicket(identity, room) {
  return {
    ok: true,
    room,
    transport: "websocket",
    physicsVersion: PHYSICS_VERSION,
    endpoint: process.env.NEXT_PUBLIC_REALTIME_WS_URL,
    ticket: signFlightTicket(
      {
        id: identity.id,
        displayName: identity.displayName,
        identityKind: identity.identityKind,
        authenticated: identity.authenticated,
      },
      room,
      process.env.REALTIME_SERVER_SECRET,
    ),
  };
}
export async function realtimeCall(action, body = {}) {
  if (!hasRealtimeServer())
    return { ok: false, status: 503, error: "REALTIME_SETUP_REQUIRED" };
  try {
    const url = new URL(
      action === "lobby"
        ? "/lobby?room=" + encodeURIComponent(body.roomName)
        : "/" + action,
      process.env.REALTIME_SERVER_URL,
    );
    const response = await fetch(url, {
      method: action === "lobby" ? "GET" : "POST",
      headers: {
        Authorization: "Bearer " + process.env.REALTIME_SERVER_SECRET,
        "content-type": "application/json",
      },
      ...(action === "lobby" ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    const result = await response.json();
    return { ...result, ...(!response.ok ? { status: response.status } : {}) };
  } catch {
    return { ok: false, status: 503, error: "REALTIME_UNAVAILABLE" };
  }
}
export function requiresRealtimeServer() {
  return process.env.NODE_ENV === "production";
}
