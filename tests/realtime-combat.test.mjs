import { createHmac } from "node:crypto";
import { createShipPulse } from "../lib/shipWeapons.js";
import { PHYSICS_VERSION } from "../lib/physics/mechanics.js";
import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import {
  CombatWorld,
  SHIP_HEALTH,
  SHIP_SHIELD,
  SPAWN_PROTECTION_MS,
  RESPAWN_MS,
} from "../lib/realtime/combatWorld.js";
import {
  signFlightTicket,
  verifyFlightTicket,
} from "../lib/realtime/tickets.js";
import { createRealtimeServer } from "../server/realtime.mjs";
import { getSolarSpawn, getEarthMiningField } from "../lib/universeFlight.js";
const secret = "test-only-realtime-secret-with-32-characters";
const origin = "http://localhost:3700";
function fixture(t, capacity = 128) {
  t.mock.timers.enable({ apis: ["Date"], now: 1792627200000 });
  t.after(() => t.mock.timers.reset());
  const world = new CombatWorld({ capacity });
  const a = world.join("shared", { id: "pilot-a", displayName: "Pilot A" }),
    b = world.join("shared", { id: "pilot-b" });
  const room = world.rooms.get("shared"),
    shooter = room.players.get(a.player.id),
    target = room.players.get(b.player.id);
  shooter.position = getSolarSpawn("pair");
  target.position = shooter.position.map((v, i) => v + (i === 0 ? 35 : 0));
  function advance(ms) {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      t.mock.timers.tick(50);
      world.tick();
    }
  }
  return { world, a, b, room, shooter, target, advance };
}
test("flight tickets are bound to trusted identity, room, audience and a 30-second expiry", () => {
  const ticket = signFlightTicket(
    { id: "google:verified" },
    "shared",
    secret,
    1000,
  );
  assert.equal(
    verifyFlightTicket(ticket, secret, 1001).identity.id,
    "google:verified",
  );
  assert.equal(
    verifyFlightTicket(ticket, secret, 1001).physicsVersion,
    PHYSICS_VERSION,
  );
  assert.throws(() => verifyFlightTicket(ticket, secret, 31000));
  assert.throws(() => verifyFlightTicket(ticket + "x", secret, 1001));
  assert.throws(() =>
    verifyFlightTicket(
      ticket,
      "another-test-secret-at-least-32-characters",
      1001,
    ),
  );
  assert.throws(() => signFlightTicket({ id: "a" }, "shared", "short"));
});
test("the fixed server clock advances flight and ignores client position, elapsed time and damage claims", (t) => {
  const { world, a, shooter, target, advance } = fixture(t);
  const before = [...shooter.position];
  assert(
    world.input("shared", a.player.id, a.token, {
      frameIndex: 1,
      controlVector: [1, 0, 0],
      direction: [1, 0, 0],
      dt: 9999,
      position: [0, 0, 0],
      damage: 99999,
      health: 99999,
      shield: 99999,
      repairState: "repairing",
      utcMs: 0,
      mass: 0,
      force: [999999, 999999, 999999],
      gravitySources: [{ position: [0, 0, 0], mu: 999999999999 }],
    }),
  );
  advance(200);
  assert(shooter.position[0] > before[0]);
  assert(Math.hypot(...shooter.position) > 100000);
  assert.equal(target.health, SHIP_HEALTH);
  assert.equal(target.shield, SHIP_SHIELD);
  assert.equal(shooter.health, SHIP_HEALTH);
  assert.equal(shooter.shield, SHIP_SHIELD);
  assert.equal(
    world.input("shared", a.player.id, "forged", {
      frameIndex: 2,
      controlVector: [1, 0, 0],
      direction: [1, 0, 0],
    }),
    false,
  );
  assert.equal(
    world.input("shared", a.player.id, a.token, {
      frameIndex: 0,
      controlVector: [1, 0, 0],
      direction: [1, 0, 0],
    }),
    false,
  );
  const snapshot = world.state("shared", a.player.id, a.token);
  assert(!JSON.stringify(snapshot.state).includes(a.token));
  assert.equal(
    typeof snapshot.state.players.find((p) => p.id === a.player.id).repairState,
    "string",
  );
  assert.equal(
    "repairState" in snapshot.state.players.find((p) => p.id === target.id),
    false,
  );
  assert.equal(
    "shieldReadyAt" in
      world
        .state("shared", a.player.id, a.token, { compact: true })
        .state.players.find((p) => p.id === target.id),
    false,
  );
});
test("live server repairs at Earth, interrupts recovery on fire, and reports shield versus hull hits", (t) => {
  const { world, a, room, shooter, target, advance } = fixture(t);
  shooter.health = 40;
  shooter.shield = 0;
  shooter.invulnerableUntil = 0;
  shooter.lastDamage = Date.now();
  advance(4900);
  assert.equal(shooter.health, 40);
  assert.equal(shooter.shield, 0);
  advance(200);
  assert(shooter.health > 40);
  assert(shooter.shield > 0);
  const repaired = shooter.health;
  assert(world.requestFire("shared", a.player.id, a.token, [-1, 0, 0]).ok);
  advance(1000);
  assert.equal(shooter.health, repaired);
  assert.equal(
    world
      .state("shared", a.player.id, a.token)
      .state.players.find((p) => p.id === a.player.id).repairState,
    "combat-lock",
  );
  target.shield = 10;
  world.damage(room, target, shooter, Date.now());
  const hit = room.events.at(-1);
  assert.equal(hit.shieldDamage, 10);
  assert.equal(hit.hullDamage, 10);
  assert.equal(hit.shieldBroken, true);
  assert.equal(target.health, 90);
  assert.equal(target.shield, 0);
  advance(4950);
  assert.equal(target.health, 90);
  advance(100);
  assert(target.health > 90);
});
test("pulses use swept server collisions, cooldown, spawn protection, shields, destruction and Earth respawn", (t) => {
  const { world, a, b, shooter, target, advance } = fixture(t);
  assert(world.requestFire("shared", a.player.id, a.token, [1, 0, 0]).ok);
  assert.equal(shooter.invulnerableUntil, Date.now());
  assert.equal(
    world.requestFire("shared", a.player.id, a.token, [1, 0, 0]).status,
    429,
  );
  advance(800);
  assert.equal(target.shield, 60, "protected pilots do not take damage");
  advance(SPAWN_PROTECTION_MS);
  for (let shot = 0; shot < 8; shot++) {
    const aim = target.position.map((v, i) => v - shooter.position[i]);
    assert(world.requestFire("shared", a.player.id, a.token, aim).ok);
    advance(250);
  }
  advance(800);
  assert.equal(target.alive, false);
  assert.equal(target.health, 0);
  assert.equal(shooter.kills, 1);
  assert.equal(target.deaths, 1);
  assert.notEqual(
    target.token,
    b.token,
    "destroying a ship revokes its cargo-bound flight credential",
  );
  assert.equal(world.state("shared", b.player.id, b.token).status, 401);
  const deathToken = target.token;
  advance(RESPAWN_MS);
  assert.equal(target.alive, true);
  assert.equal(target.health, 100);
  assert.equal(target.shield, 60);
  assert.equal(target.revision, 1);
  assert(
    Math.hypot(
      ...target.position.map((v, i) => v - getSolarSpawn(target.id)[i]),
    ) < 2,
  );
  assert.equal(world.state("shared", target.id, deathToken).ok, true);
});
test("rooms isolate combat; the 128-player service limit applies across all room names", (t) => {
  const { world, a, target, advance } = fixture(t, 128);
  target.invulnerableUntil = 0;
  const isolated = world.join("elsewhere", { id: "isolated" });
  const other = world.rooms.get("elsewhere").players.get("isolated");
  other.position = [...target.position];
  other.invulnerableUntil = 0;
  world.requestFire("shared", a.player.id, a.token, [1, 0, 0]);
  advance(800);
  assert.equal(other.shield, 60);
  assert.equal(target.shield, 40);
  for (let i = 3; i < 128; i++)
    assert(world.join("shared", { id: "p" + i }).ok);
  assert.equal(
    world.state("shared", a.player.id, a.token).state.players.length,
    127,
  );
  assert.equal(world.join("new-room", { id: "overflow" }).error, "SERVER_FULL");
  assert.equal(world.join("shared", { id: a.player.id }).token, a.token);
  world.disconnect("elsewhere", "isolated", isolated.token);
  assert(world.join("new-room", { id: "next" }).ok);
  advance(31000);
  assert.equal(world.rooms.size, 0);
});
function nextPacket(socket, predicate, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", message);
      reject(Error("Timed out waiting for real-time packet"));
    }, timeout);
    function message(raw) {
      const data = JSON.parse(raw.toString());
      if (predicate(data)) {
        clearTimeout(timer);
        socket.off("message", message);
        resolve(data);
      }
    }
    socket.on("message", message);
  });
}
async function openClient(address, identity, options = {}) {
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/flight`, {
    origin,
  });
  const joined = nextPacket(
    socket,
    (p) => p.type === "joined" || p.type === "rejected",
  );
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  socket.send(
    JSON.stringify({
      type: "join",
      physicsVersion: Object.hasOwn(options, "physicsVersion")
        ? options.physicsVersion
        : PHYSICS_VERSION,
      ticket:
        options.ticket || signFlightTicket({ id: identity }, "live", secret),
    }),
  );
  return { socket, joined: await joined };
}
test("real WebSocket clients share authoritative snapshots; admission, origins, tickets and service reads are enforced", async (t) => {
  const app = createRealtimeServer({
    secret,
    origins: [origin],
    capacity: 2,
    port: 0,
    host: "127.0.0.1",
  });
  const address = await app.listen();
  t.after(() => app.close());
  const { socket: a, joined: pa } = await openClient(address, "a"),
    { socket: b } = await openClient(address, "b");
  t.after(() => {
    a.terminate();
    b.terminate();
  });
  assert.equal(pa.transport, "websocket");
  const full = await nextPacket(
    a,
    (p) => p.type === "state" && p.state.playerCount === 2,
  );
  assert.equal(full.state.tickRate, 20);
  assert.equal(full.state.players.length, 2);
  assert(!JSON.stringify(full.state).includes(pa.token));
  const overflow = await openClient(address, "c");
  assert.equal(overflow.joined.error, "ROOM_FULL");
  overflow.socket.terminate();
  const before = full.state.players.find((p) => p.id === "a");
  a.send(
    JSON.stringify({
      type: "input",
      revision: 0,
      frameIndex: 10,
      controlVector: [1, 0, 0],
      direction: [1, 0, 0],
      position: [0, 0, 0],
    }),
  );
  const after = await nextPacket(
    a,
    (p) =>
      p.type === "state" &&
      p.state.players.some(
        (pilot) => pilot.id === "a" && pilot.frameIndex === 10,
      ),
  );
  assert(
    after.state.players.find((p) => p.id === "a").position[0] >=
      before.position[0],
  );
  const base = `http://127.0.0.1:${address.port}`;
  assert.equal(
    (await fetch(base + "/state", { method: "POST", body: "{}" })).status,
    401,
  );
  assert.equal(
    (
      await fetch(base + "/state", {
        method: "POST",
        headers: { authorization: "Bearer " + secret },
        body: JSON.stringify({ roomName: "live", id: "a", token: pa.token }),
      })
    ).status,
    200,
  );
  await new Promise((resolve) => {
    const bad = new WebSocket(`ws://127.0.0.1:${address.port}/flight`, {
      origin: "https://untrusted.invalid",
    });
    bad.on("error", resolve);
  });
  await new Promise((resolve, reject) => {
    const bad = new WebSocket(`ws://127.0.0.1:${address.port}/flight`, {
      origin,
    });
    bad.on("open", () =>
      bad.send(
        JSON.stringify({
          type: "join",
          physicsVersion: PHYSICS_VERSION,
          ticket: "forged",
        }),
      ),
    );
    bad.on("close", (code) => {
      try {
        assert.equal(code, 1008);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
    bad.on("error", reject);
  });
});

test("one verified identity owns one flight across rooms, and moving rooms frees the old slot", () => {
  const world = new CombatWorld({ capacity: 1 });
  const first = world.join("one", { id: "account" });
  const next = world.join("two", { id: "account" });
  assert(next.ok);
  assert.notEqual(next.token, first.token);
  assert.equal(world.state("one", "account", first.token).status, 401);
  assert.equal(world.rooms.size, 1);
  assert.equal(world.lobby("other").population.available, 0);
  assert.equal(world.lobby("other").population.full, true);
});

test("authoritative ship contacts stop high-speed crossing with mass-weighted impulses", (t) => {
  const { world, a, b, shooter, target, room, advance } = fixture(t);
  shooter.position = [-20, 0, 18];
  target.position = [20, 0, 18];
  shooter.velocity = [2000, 0, 0];
  target.velocity = [-2000, 0, 0];
  shooter.lastInput = target.lastInput = Date.now();
  advance(50);
  assert(shooter.position[0] < target.position[0]);
  assert(shooter.velocity[0] < 0 && target.velocity[0] > 0);
  assert(
    Math.hypot(...shooter.position.map((v, i) => v - target.position[i])) >=
      6.4,
  );
  assert(room.events.some((event) => event.type === "collision"));
  assert.equal(shooter.health, 100);
  assert.equal(target.health, 100);
  const state = world.state("shared", a.player.id, a.token).state;
  assert.equal(state.physicsVersion, PHYSICS_VERSION);
  assert.equal(state.physicsUtcMs, Date.now());
  assert(!JSON.stringify(state).includes("previousPosition"));
  assert(world.state("shared", b.player.id, b.token).ok);
});

test("pulse sweeps hit a moving ship even when it crosses entirely between server snapshots", (t) => {
  const { world, a, shooter, target, advance } = fixture(t);
  shooter.position = [0, 0, 18];
  target.position = [20, -450, 18];
  shooter.velocity = [0, 0, 0];
  target.velocity = [0, 2000, 0];
  shooter.lastInput = target.lastInput = Date.now();
  target.invulnerableUntil = 0;
  assert(world.requestFire("shared", a.player.id, a.token, [1, 0, 0]).ok);
  advance(250);
  assert.equal(target.shield, 40);
});

test("shared snapshot caches are immutable, contain no flight token and refresh on same-tick state changes", (t) => {
  const { world, a, room, shooter, target } = fixture(t);
  const first = world
    .state("shared", a.player.id, a.token)
    .state.players.find((p) => p.id === a.player.id);
  const repeated = world
    .state("shared", a.player.id, a.token)
    .state.players.find((p) => p.id === a.player.id);
  assert.equal(first, repeated);
  assert(Object.isFrozen(first.position));
  assert.throws(() => {
    first.position[0] = 0;
  }, TypeError);
  world.damage(room, shooter, target, Date.now());
  const changed = world
    .state("shared", a.player.id, a.token)
    .state.players.find((p) => p.id === a.player.id);
  assert.notEqual(changed, first);
  assert.equal(changed.shield, 40);
  assert(!JSON.stringify(changed).includes(a.token));
  world.requestFire("shared", shooter.id, shooter.token, [0, 0, 1]);
  const shot = world.state("shared", a.player.id, a.token).state.projectiles[0];
  assert(Object.isFrozen(shot.position));
  assert.equal(
    shot,
    world.state("shared", a.player.id, a.token).state.projectiles[0],
  );
});

test("server cannon and prediction share muzzle, lifetime and inherited velocity", (t) => {
  const { world, a, room, shooter } = fixture(t);
  shooter.velocity = [100, 20, -10];
  const aim = [1, 2, 3];
  const predicted = createShipPulse({
    position: shooter.position,
    direction: aim,
    inheritedVelocity: shooter.velocity,
    now: Date.now(),
    id: "prediction",
  });
  assert(world.requestFire("shared", a.player.id, a.token, aim).ok);
  const authoritative = room.shots[0];
  for (const key of [
    "origin",
    "velocity",
    "direction",
    "createdAt",
    "expiresAt",
  ])
    assert.deepEqual(authoritative[key], predicted[key]);
  assert.deepEqual(authoritative.position, predicted.origin);
});

test("physics mismatch rejects old clients and signed old website tickets before creating or replacing a flight", async (t) => {
  const app = createRealtimeServer({
    secret,
    origins: [origin],
    port: 0,
    host: "127.0.0.1",
  });
  const address = await app.listen();
  t.after(() => app.close());
  const original = await openClient(address, "versioned");
  t.after(() => original.socket.terminate());
  assert.equal(original.joined.physicsVersion, PHYSICS_VERSION);
  const payload = JSON.parse(
    Buffer.from(
      signFlightTicket({ id: "versioned" }, "live", secret).split(".")[0],
      "base64url",
    ).toString(),
  );
  payload.physicsVersion = "universe-physics-1";
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const oldTicket =
    body + "." + createHmac("sha256", secret).update(body).digest("base64url");
  for (const options of [
    { physicsVersion: undefined },
    { physicsVersion: "universe-physics-1" },
    { ticket: oldTicket },
  ]) {
    const rejected = await openClient(address, "versioned", options);
    assert.equal(rejected.joined.error, "PHYSICS_VERSION_MISMATCH");
    assert.equal(rejected.joined.physicsVersion, PHYSICS_VERSION);
    rejected.socket.terminate();
    assert.equal(
      app.world.find("live", "versioned", original.joined.token)?.token,
      original.joined.token,
    );
    assert.equal(app.world.rooms.get("live").players.size, 1);
  }
  const health = await (
    await fetch(`http://127.0.0.1:${address.port}/healthz`)
  ).json();
  assert.equal(health.physicsVersion, PHYSICS_VERSION);
});

test("the authoritative service brakes smoothly when a fast ship enters a precision region", (t) => {
  const { world, a, shooter, advance } = fixture(t);
  shooter.position = [...getEarthMiningField(Date.now()).center];
  shooter.velocity = [0, 0, 1000];
  shooter.lastInput = 0;
  const previous = [...shooter.position];
  advance(50);
  assert(
    Math.hypot(...shooter.velocity) > 800 &&
      Math.hypot(...shooter.velocity) < 1000,
  );
  assert(Math.hypot(...shooter.position.map((v, i) => v - previous[i])) > 30);
  assert.equal(shooter.health, SHIP_HEALTH);
  assert.equal(
    world.state("shared", a.player.id, a.token).state.physicsVersion,
    PHYSICS_VERSION,
  );
});
