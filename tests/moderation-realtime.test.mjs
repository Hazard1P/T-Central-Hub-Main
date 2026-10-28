import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { once } from "node:events";
import { createRealtimeServer } from "../server/realtime.mjs";
import { signFlightTicket } from "../lib/realtime/tickets.js";
import { PHYSICS_VERSION } from "../lib/physics/mechanics.js";
const secret = "moderation-test-secret-".repeat(3),
  origin = "http://localhost:3000";
function packet(socket, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", listener);
      reject(Error("Timed out waiting for " + type));
    }, 4000);
    const listener = (raw) => {
      const data = JSON.parse(raw);
      if (data.type === type) {
        clearTimeout(timer);
        socket.off("message", listener);
        resolve(data);
      }
    };
    socket.on("message", listener);
  });
}
async function open(
  address,
  id,
  ticket = signFlightTicket({ id, displayName: "Explorer" }, "shared", secret),
) {
  const socket = new WebSocket("ws://127.0.0.1:" + address.port + "/flight", {
    origin,
  });
  await once(socket, "open");
  return {
    socket,
    join() {
      socket.send(
        JSON.stringify({
          type: "join",
          ticket,
          physicsVersion: PHYSICS_VERSION,
        }),
      );
    },
  };
}
test("durable ban checks reject already-issued tickets, kick live pilots, clear shots and permit return after expiry or unban", async (t) => {
  let bans = [];
  const checkAccess = async () => ({ ok: true, bans });
  const app = createRealtimeServer({
    secret,
    origins: [origin],
    host: "127.0.0.1",
    port: 0,
    checkAccess,
    moderationIntervalMs: 100,
  });
  const address = await app.listen();
  t.after(() => app.close());
  const id = "google:player",
    ticket = signFlightTicket(
      { id, displayName: "Before rename" },
      "shared",
      secret,
    );
  const first = await open(address, id, ticket);
  t.after(() => first.socket.terminate());
  let wait = packet(first.socket, "joined");
  first.join();
  const joined = await wait;
  const p = app.world.rooms.get("shared").players.get(id),
    room = app.world.rooms.get("shared");
  p.position = [0, 0, 18];
  assert(app.world.requestFire("shared", id, joined.token, [0, 0, 1]).ok);
  assert(room.shots.some(s => s.ownerId === id));
  app.world.updateIdentity(id, "After rename");
  const rejected = packet(first.socket, "rejected");
  const closed = once(first.socket, "close");
  bans = [{ account_key: id, reason: "Reviewed harassment", expires_at: null }];
  assert.equal((await rejected).error, "ACCOUNT_BANNED");
  assert.equal((await closed)[0], 4004);
  assert(!app.world.rooms.get("shared")?.players.has(id));
  assert(!room.shots.some((s) => s.ownerId === id));
  const replay = await open(address, id, ticket);
  t.after(() => replay.socket.terminate());
  wait = packet(replay.socket, "rejected");
  replay.join();
  assert.equal((await wait).status, 403);
  bans = [];
  const returned = await open(address, id);
  t.after(() => returned.socket.terminate());
  wait = packet(returned.socket, "joined");
  returned.join();
  assert((await wait).ok);
});
test("account admission fails closed during a database outage, including on a restarted game worker", async (t) => {
  const app = createRealtimeServer({
    secret,
    origins: [origin],
    host: "127.0.0.1",
    port: 0,
    checkAccess: async () => {
      throw Error("Database offline");
    },
  });
  const address = await app.listen();
  t.after(() => app.close());
  const client = await open(address, "google:blocked");
  t.after(() => client.socket.terminate());
  const wait = packet(client.socket, "rejected");
  client.join();
  assert.equal((await wait).error, "MODERATION_UNAVAILABLE");
  assert.equal(app.world.rooms.size, 0);
});
test("service-secret moderation refresh enforces a stored ban without allowing a public kick", async (t) => {
  let bans = [];
  const app = createRealtimeServer({
    secret,
    origins: [origin],
    host: "127.0.0.1",
    port: 0,
    checkAccess: async () => ({ ok: true, bans }),
    moderationIntervalMs: 60000,
  });
  const address = await app.listen();
  t.after(() => app.close());
  const client = await open(address, "google:player");
  t.after(() => client.socket.terminate());
  let wait = packet(client.socket, "joined");
  client.join();
  await wait;
  const endpoint = "http://127.0.0.1:" + address.port + "/moderation";
  assert.equal(
    (
      await fetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ id: "google:player" }),
      })
    ).status,
    401,
  );
  bans = [
    {
      account_key: "google:player",
      reason: "Reviewed report",
      expires_at: "2026-12-01T00:00:00Z",
    },
  ];
  wait = packet(client.socket, "rejected");
  const result = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: "Bearer " + secret },
    body: JSON.stringify({ id: "google:player" }),
  });
  assert.equal(result.status, 200);
  assert.equal((await wait).error, "ACCOUNT_BANNED");
});
