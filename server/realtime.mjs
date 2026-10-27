import { createCommunityChat } from "./communityChat.mjs";
import { createCommunityChatRepository } from "../lib/server/communityChatRepository.js";
import { getSupabaseAdmin } from "../lib/server/supabaseAdmin.js";
import { createModerationRepository } from "../lib/server/moderationRepository.js";
import { banDenial, ACCOUNT_KEY_PATTERN } from "../lib/moderation.js";
import http from "node:http";
import { pathToFileURL } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { PHYSICS_VERSION } from "../lib/physics/mechanics.js";
import {
  CombatWorld,
  TICK_MS,
  SNAPSHOT_MS,
} from "../lib/realtime/combatWorld.js";
import {
  verifyFlightTicket,
  validServiceSecret,
} from "../lib/realtime/tickets.js";
export function createRealtimeServer({
  secret,
  origins,
  capacity,
  port = 8080,
  host = "0.0.0.0",
  world = new CombatWorld({ capacity }),
  checkAccess = createModerationRepository(getSupabaseAdmin()).access,
  moderationIntervalMs = 5000,
  chatStore = createCommunityChatRepository(getSupabaseAdmin()),
} = {}) {
  if (typeof secret !== "string" || secret.length < 32)
    throw Error("REALTIME_SERVER_SECRET must contain at least 32 characters.");
  if (!origins?.length || origins.includes("*"))
    throw Error("Set explicit REALTIME_ALLOWED_ORIGINS.");
  const clients = new Map();
  let nextClient = 0;
  const send = (socket, body) => {
    if (
      socket.readyState === WebSocket.OPEN &&
      socket.bufferedAmount < 1_000_000
    )
      socket.send(JSON.stringify(body));
    else if (socket.bufferedAmount >= 1_000_000)
      socket.close(1013, "Connection too slow");
  };
  const accessFor = async (ids) => {
    try {
      return await checkAccess(ids);
    } catch {
      return { ok: false, error: "MODERATION_UNAVAILABLE" };
    }
  };
  const removeDenied = (id, denial) => {
    for (const [roomName, room] of world.rooms) {
      const pilot = room.players.get(id);
      if (pilot) world.disconnect(roomName, id, pilot.token);
    }
    for (const socket of clients.values())
      if (socket.pilot?.id === id) {
        send(socket, { type: "rejected", ...denial });
        socket.close(4004, denial.error);
      }
  };
  async function enforceAccounts(ids) {
    const accounts = [
      ...new Set(ids.filter((id) => ACCOUNT_KEY_PATTERN.test(id))),
    ];
    if (!accounts.length) return { ok: true };
    const result = await accessFor(accounts);
    chat.applyAccess(accounts, result);
    for (const id of accounts) {
      const denial = banDenial(result, id);
      if (!denial.ok) removeDenied(id, denial);
    }
    return result;
  }
  const server = http.createServer(async (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      res.end(JSON.stringify(body));
    };
    let url;
    try {
      url = new URL(req.url, "http://localhost");
    } catch {
      reply(400, { ok: false, error: "INVALID_URL" });
      return;
    }
    if (url.pathname === "/healthz")
      return reply(200, {
        ok: true,
        transport: "websocket",
        tickRate: 20,
        snapshotRate: 10,
        capacity: world.capacity,
        physicsVersion: PHYSICS_VERSION,
      });
    if (!validServiceSecret(req.headers.authorization, secret))
      return reply(401, { ok: false, error: "SERVICE_AUTH_REQUIRED" });
    try {
      if (url.pathname === "/lobby") {
        const room = url.searchParams.get("room");
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(room))
          return reply(400, { ok: false, error: "INVALID_ROOM" });
        world.prune(Date.now());
        return reply(200, world.lobby(room));
      }
      if (req.method !== "POST") return reply(405, { ok: false });
      let text = "";
      for await (const chunk of req) {
        text += chunk;
        if (text.length > 8192) return reply(413, { ok: false });
      }
      const body = JSON.parse(text),
        { roomName, id, token } = body;
      let result;
      if (url.pathname === "/chat-moderation") {
        await chat.refreshHistory();
        return reply(200, { ok: true });
      } else if (url.pathname === "/moderation") {
        if (!ACCOUNT_KEY_PATTERN.test(id))
          return reply(400, { ok: false, error: "INVALID_ACCOUNT" });
        result = await enforceAccounts([id]);
      } else if (["/state", "/action"].includes(url.pathname)) {
        // Validate the existing session before looking up an account's ban status.
        const state = world.state(roomName, id, token);
        if (!state.ok) return reply(state.status || 401, state);
        const denial = banDenial(await accessFor([id]), id);
        if (!denial.ok) {
          removeDenied(id, denial);
          return reply(denial.status, denial);
        }
        result =
          url.pathname === "/state"
            ? state
            : world.requestFire(roomName, id, token, body.action?.direction);
      } else if (url.pathname === "/identity") {
        result = world.updateIdentity(id, body.displayName);
        if (result.ok) chat.updateIdentity(id, body.displayName);
      } else if (url.pathname === "/disconnect") {
        result = world.disconnect(roomName, id, token);
        if (result.ok)
          for (const socket of clients.values())
            if (socket.pilot?.room === roomName && socket.pilot.id === id)
              socket.close(1000, "Flight ended");
      } else if (url.pathname === "/action")
        result = world.requestFire(roomName, id, token, body.action?.direction);
      else result = { ok: false, status: 404 };
      reply(result.status || 200, result);
    } catch {
      reply(400, { ok: false, error: "INVALID_REQUEST" });
    }
  });
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: 4096,
    perMessageDeflate: false,
  });
  const chat = createCommunityChat({
    secret,
    origins,
    checkAccess: accessFor,
    store: chatStore,
    intervalMs: moderationIntervalMs,
  });
  server.on("upgrade", (req, socket, head) => {
    let pathname;
    try {
      pathname = new URL(req.url, "http://localhost").pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (pathname === "/chat") return chat.handleUpgrade(req, socket, head);
    if (
      pathname !== "/flight" ||
      !origins.includes(req.headers.origin) ||
      clients.size >= world.capacity * 2
    ) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(req, socket, head, (ws) =>
      sockets.emit("connection", ws, req),
    );
  });
  sockets.on("connection", (socket) => {
    socket.clientId = ++nextClient;
    socket.alive = true;
    socket.windowStart = Date.now();
    socket.messageCount = 0;
    clients.set(socket.clientId, socket);
    const authTimeout = setTimeout(() => {
      if (!socket.pilot) socket.close(1008, "Join ticket required");
    }, 5000);
    socket.on("pong", () => {
      socket.alive = true;
      if (socket.pilot) world.touch(socket.pilot.room, socket.pilot.id);
    });
    socket.on("message", async (raw) => {
      if (Date.now() - socket.windowStart >= 1000) {
        socket.windowStart = Date.now();
        socket.messageCount = 0;
      }
      if (++socket.messageCount > 100) {
        socket.close(1008, "Input rate exceeded");
        return;
      }
      try {
        const message = JSON.parse(raw.toString());
        if (!socket.pilot) {
          if (socket.joining) return;
          if (message.type !== "join") throw Error("Join first");
          socket.joining = true;
          const ticket = verifyFlightTicket(message.ticket, secret);
          if (
            ticket.physicsVersion !== PHYSICS_VERSION ||
            message.physicsVersion !== PHYSICS_VERSION
          ) {
            send(socket, {
              type: "rejected",
              ok: false,
              status: 409,
              error: "PHYSICS_VERSION_MISMATCH",
              physicsVersion: PHYSICS_VERSION,
            });
            socket.close(4003, "Matching flight version required");
            return;
          }
          const denial = banDenial(
            await accessFor([ticket.identity.id]),
            ticket.identity.id,
          );
          if (socket.readyState !== WebSocket.OPEN) return;
          if (!denial.ok) {
            send(socket, { type: "rejected", ...denial });
            socket.close(4004, denial.error);
            return;
          }
          const joined = world.join(ticket.room, ticket.identity);
          if (!joined.ok) {
            send(socket, { type: "rejected", ...joined });
            socket.close(1008, joined.error);
            return;
          }
          for (const previous of clients.values())
            if (
              previous !== socket &&
              previous.pilot?.id === ticket.identity.id
            )
              previous.close(4002, "Flight resumed on another connection");
          socket.pilot = { room: ticket.room, id: ticket.identity.id };
          clearTimeout(authTimeout);
          send(socket, { type: "joined", ...joined, transport: "websocket" });
          return;
        }
        const { room, id } = socket.pilot,
          p = world.rooms.get(room)?.players.get(id);
        if (!p) {
          socket.close(4001, "Session expired");
          return;
        }
        if (message.revision !== p.revision) return;
        if (message.type === "input") world.input(room, id, p.token, message);
        if (message.type === "fire")
          world.requestFire(room, id, p.token, message.direction);
      } catch {
        socket.close(1008, "Invalid flight message");
      }
    });
    socket.on("error", () => {});
    socket.on("close", (code) => {
      clearTimeout(authTimeout);
      clients.delete(socket.clientId);
      const pilot = socket.pilot;
      if (!pilot) return;
      const replaced = [...clients.values()].some(
        (s) => s.pilot?.room === pilot.room && s.pilot.id === pilot.id,
      );
      const p = world.rooms.get(pilot.room)?.players.get(pilot.id);
      if (!replaced && p) {
        p.control = [0, 0, 0];
        p.lastInput = 0;
        if (code === 1000) world.disconnect(pilot.room, pilot.id, p.token);
      }
    });
  });
  let moderationRunning = false;
  const moderationTimer = setInterval(
    async () => {
      if (moderationRunning) return;
      moderationRunning = true;
      try {
        await enforceAccounts(
          [...world.rooms.values()].flatMap((room) => [...room.players.keys()]),
        );
      } finally {
        moderationRunning = false;
      }
    },
    Math.max(100, moderationIntervalMs),
  );
  const tick = setInterval(() => world.tick(), TICK_MS);
  let rosterTick = 0;
  const snapshots = setInterval(() => {
    const full = ++rosterTick % 10 === 0;
    for (const socket of clients.values()) {
      if (!socket.pilot) continue;
      const { room, id } = socket.pilot,
        p = world.rooms.get(room)?.players.get(id);
      if (!p) {
        socket.close(4001, "Session expired");
        continue;
      }
      send(socket, {
        type: "state",
        fullRoster: full,
        ...world.state(room, id, p.token, { compact: !full }),
      });
    }
  }, SNAPSHOT_MS);
  const heartbeat = setInterval(() => {
    for (const socket of clients.values()) {
      if (!socket.alive) {
        socket.terminate();
        continue;
      }
      socket.alive = false;
      socket.ping();
    }
  }, 10000);
  return {
    server,
    world,
    listen: () =>
      new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          resolve(server.address());
        });
      }),
    close: async () => {
      clearInterval(moderationTimer);
      clearInterval(tick);
      clearInterval(snapshots);
      clearInterval(heartbeat);
      for (const socket of clients.values()) socket.terminate();
      await chat.close();
      await new Promise((resolve) => sockets.close(resolve));
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const app = createRealtimeServer({
    secret: process.env.REALTIME_SERVER_SECRET,
    origins: (process.env.REALTIME_ALLOWED_ORIGINS || process.env.APP_URL || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    port: Number(process.env.PORT || 8080),
  });
  await app.listen();
  console.log(
    "T-Central authoritative WebSocket server ready: 20 Hz simulation, 10 Hz snapshots.",
  );
  const stop = async () => {
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
