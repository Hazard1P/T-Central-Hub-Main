import test from "node:test";
import assert from "node:assert/strict";
import { Vector3, Quaternion } from "three";
import { CombatWorld } from "../lib/realtime/combatWorld.js";
import {
  getEarthLandingSites,
  getEarthLandingPad,
  landingPadVelocity,
  getEarthLandingDestinations,
  getEarthSurfaceStatus,
  validateEarthLanding,
  takeoffEarthPose,
  earthTerrainHeight,
  constrainEarthSurfaceFlight,
} from "../lib/earthLanding.js";
import { createPhysicsFrame } from "../lib/physics/world.js";
import { SHIP_CONTACT_RADIUS } from "../lib/physics/mechanics.js";
import { isInEarthSafeZone } from "../lib/earthSafeZone.js";
import { WebSocket } from "ws";
import { createRealtimeServer } from "../server/realtime.mjs";
import { signFlightTicket } from "../lib/realtime/tickets.js";
import { PHYSICS_VERSION } from "../lib/physics/mechanics.js";
const epoch = Date.UTC(2026, 9, 28);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
function fixture(t) {
  t.mock.timers.enable({ apis: ["Date"], now: epoch });
  t.after(() => t.mock.timers.reset());
  const world = new CombatWorld(),
    a = world.join("landing", { id: "a" }),
    b = world.join("landing", { id: "b" });
  const room = world.rooms.get("landing"),
    pilot = room.players.get("a"),
    other = room.players.get("b"),
    pad = getEarthLandingPad("pacific-1");
  pilot.position = pad.position.map((v, i) => v + pad.up[i] * 15);
  pilot.velocity = landingPadVelocity(pad.id);
  return {
    world,
    a,
    b,
    room,
    pilot,
    other,
    pad,
    advance(ms) {
      for (let n = 0; n < ms; n += 50) {
        t.mock.timers.tick(50);
        world.tick();
      }
    },
  };
}
test("three UTC-rotating Earth ports have twelve separated protected pads with orthonormal render frames", () => {
  const sites = getEarthLandingSites(epoch),
    pads = sites.flatMap((s) => s.pads);
  assert.equal(sites.length, 3);
  assert.equal(pads.length, 12);
  assert.equal(new Set(pads.map((p) => p.id)).size, 12);
  for (const site of sites)
    for (const pad of site.pads) {
      assert(isInEarthSafeZone(pad.position, epoch));
      assert(
        distance(pad.position, site.earth.position) >
          site.radius + SHIP_CONTACT_RADIUS,
      );
      const q = new Quaternion(...pad.orientation);
      for (const [local, world] of [
        [[1, 0, 0], pad.right],
        [[0, 1, 0], pad.up],
        [[0, 0, 1], pad.north],
      ])
        assert(
          distance(new Vector3(...local).applyQuaternion(q).toArray(), world) <
            1e-8,
        );
      for (const other of pads)
        if (other.id !== pad.id)
          assert(
            distance(other.position, pad.position) > SHIP_CONTACT_RADIUS * 2,
          );
    }
  assert(!getEarthLandingPad("forged", epoch));
  assert.equal(getEarthLandingDestinations(epoch).length, 3);
  assert(
    distance(
      pads[0].position,
      getEarthLandingPad(pads[0].id, epoch + 3600000).position,
    ) > 1000,
  );
});
test("dock anchoring is smooth across UTC seconds and valid near either pole", () => {
  const pad = getEarthLandingPad("atlantic-1", epoch),
    before = getEarthLandingPad(pad.id, epoch + 999),
    after = getEarthLandingPad(pad.id, epoch + 1001);
  assert(distance(before.position, after.position) < 0.01);
  assert(Math.hypot(...landingPadVelocity(pad.id, epoch + 1001)) < 2);
  const earth = getEarthLandingSites(epoch)[0].earth;
  for (const side of [-1, 1]) {
    const point = earth.position.map(
      (v, i) => v + earth.orientation.y[i] * earth.radius * 1.1 * side,
    );
    const status = getEarthSurfaceStatus(point, [0, 0, 0], epoch);
    assert(status.active);
    assert(Math.abs(Math.hypot(...status.orientation) - 1) < 1e-8);
  }
});
test("landing requires a known free pad, capture distance and low relative speed", () => {
  const pad = getEarthLandingPad("pacific-1", epoch),
    velocity = landingPadVelocity(pad.id, epoch);
  const args = { position: pad.position, velocity, padId: pad.id };
  assert(validateEarthLanding(args, epoch).ok);
  assert(!validateEarthLanding({ ...args, padId: "moon-pad" }, epoch).ok);
  assert.equal(
    validateEarthLanding({ ...args, occupied: [pad.id] }, epoch).status,
    409,
  );
  assert(
    !validateEarthLanding(
      { ...args, position: pad.position.map((v, i) => v + pad.up[i] * 40) },
      epoch,
    ).ok,
  );
  assert(
    !validateEarthLanding(
      { ...args, velocity: velocity.map((v, i) => v + (i === 0 ? 8.01 : 0)) },
      epoch,
    ).ok,
  );
  assert(getEarthSurfaceStatus(pad.position, velocity, epoch).canLand);
});
test("the server owns landing, holds a ship on rotating Earth and ignores client movement while docked", (t) => {
  const { world, a, pilot, pad, advance } = fixture(t);
  assert.equal(
    world.requestLanding("landing", "a", "forged", "land", pad.id).status,
    401,
  );
  const token = pilot.token,
    health = pilot.health;
  assert(world.requestLanding("landing", "a", a.token, "land", pad.id).ok);
  assert.equal(pilot.landedAt, pad.id);
  assert(
    world.requestLanding("landing", "a", a.token, "land", pad.id).ok,
    "retries are idempotent",
  );
  for (let frame = 1; frame <= 30; frame++) {
    assert(
      world.input("landing", "a", a.token, {
        frameIndex: frame,
        controlVector: [1, 1, 1],
        direction: [1, 0, 0],
        position: [0, 0, 0],
      }),
    );
    advance(50);
  }
  assert(distance(pilot.position, getEarthLandingPad(pad.id).position) < 1e-8);
  assert.equal(pilot.health, health);
  assert.equal(pilot.token, token);
  assert.deepEqual(pilot.control, [0, 0, 0]);
  const state = world.state("landing", "a", token).state;
  assert.equal(state.players.find((p) => p.id === "a").landedAt, pad.id);
  assert(!JSON.stringify(state).includes(token));
  assert.equal(
    world.requestFire("landing", "a", token, [0, 0, 1]).error,
    "EARTH_SAFE_ZONE",
  );
  assert.equal(world.join("landing", { id: "a" }).player.landedAt, pad.id);
});
test("pad reservation is atomic in a room; another pilot must use a different berth", (t) => {
  const { world, a, b, pilot, other, pad } = fixture(t);
  assert(world.requestLanding("landing", "a", a.token, "land", pad.id).ok);
  other.position = [...pilot.position];
  other.velocity = [...pilot.velocity];
  assert.equal(
    world.requestLanding("landing", "b", b.token, "land", pad.id).status,
    409,
  );
  const alternate = getEarthLandingPad("pacific-2");
  other.position = [...alternate.position];
  assert(
    world.requestLanding("landing", "b", b.token, "land", alternate.id).ok,
  );
  assert.notEqual(other.landedAt, pilot.landedAt);
});
test("takeoff releases the berth with safe outward clearance and preserves account/flight state", (t) => {
  const { world, a, b, pilot, other, pad, advance } = fixture(t);
  pilot.kills = 2;
  assert(world.requestLanding("landing", "a", a.token, "land", pad.id).ok);
  const pose = takeoffEarthPose(pad.id);
  assert(
    world.requestLanding(
      "landing",
      "a",
      a.token,
      "takeoff",
      "forged-client-target",
    ).ok,
  );
  assert.equal(pilot.landedAt, null);
  assert.deepEqual(pilot.position, pose.position);
  assert.equal(pilot.kills, 2);
  assert(distance(pilot.position, pad.position) > 10);
  assert.equal(
    world.requestLanding("landing", "a", a.token, "takeoff").status,
    409,
  );
  other.position = [...pad.position];
  other.velocity = landingPadVelocity(pad.id);
  assert(world.requestLanding("landing", "b", b.token, "land", pad.id).ok);
  advance(250);
  assert.equal(other.landedAt, pad.id);
  assert(world.state("landing", "a", a.token).ok);
});
test("landing rejects distant, speeding, disabled and unknown-action requests without teleporting", (t) => {
  const { world, a, pilot, pad } = fixture(t);
  const original = [...pilot.position];
  assert.equal(
    world.requestLanding("landing", "a", a.token, "teleport", pad.id).status,
    400,
  );
  pilot.velocity = [100, 0, 0];
  assert(!world.requestLanding("landing", "a", a.token, "land", pad.id).ok);
  assert.deepEqual(pilot.position, original);
  pilot.velocity = [0, 0, 0];
  pilot.position = [0, 0, 18];
  assert(!world.requestLanding("landing", "a", a.token, "land", pad.id).ok);
  pilot.alive = false;
  assert.equal(
    world.requestLanding("landing", "a", a.token, "land", pad.id).status,
    401,
  );
});
test("surface structures participate in the shared physics frame and terrain remains finite", () => {
  const frame = createPhysicsFrame({ utcMs: epoch });
  assert.equal(
    frame.bodies.filter((b) => b.key?.includes("-structure-")).length,
    9,
  );
  for (let x = -56; x <= 56; x += 4)
    for (let z = -56; z <= 56; z += 4)
      assert(Number.isFinite(earthTerrainHeight(x, z, 175)));
});

test("surface flight uses the rendered plateau and pad heights, preserves tangent motion and blocks descent through the ground", () => {
  const site = getEarthLandingSites(epoch)[0],
    pad = site.pads[0];
  assert.equal(earthTerrainHeight(29, 0, site.radius), 0);
  const location = site.position.map(
    (v, i) => v + site.right[i] * 24 + site.up[i],
  );
  const velocity = site.up.map((v, i) => -v * 10 + site.right[i] * 3);
  const grounded = constrainEarthSurfaceFlight(location, velocity, epoch);
  const height = grounded.position.reduce(
    (sum, v, i) => sum + (v - site.position[i]) * site.up[i],
    0,
  );
  assert(Math.abs(height - SHIP_CONTACT_RADIUS) < 1e-8);
  assert(
    Math.abs(grounded.velocity.reduce((sum, v, i) => sum + v * site.up[i], 0)) <
      1e-8,
  );
  assert(Math.abs(Math.hypot(...grounded.velocity) - 3) < 1e-8);
  const overPad = constrainEarthSurfaceFlight(pad.position, [0, 0, 0], epoch);
  const padHeight = overPad.position.reduce(
    (sum, v, i) => sum + (v - site.position[i]) * site.up[i],
    0,
  );
  assert(Math.abs(padHeight - (3.5 + SHIP_CONTACT_RADIUS)) < 1e-8);
  const distant = [0, 0, 18];
  assert.deepEqual(
    constrainEarthSurfaceFlight(distant, velocity, epoch).position,
    distant,
  );
});

test("real WebSocket pilots share landing state; actions acknowledge errors and cannot control another ship", async (t) => {
  const secret = "landing-integration-fixture-secret-0123456789",
    origin = "http://localhost:3700";
  const app = createRealtimeServer({
    secret,
    origins: [origin],
    host: "127.0.0.1",
    port: 0,
  });
  const address = await app.listen();
  t.after(() => app.close());
  const sockets = [];
  t.after(() => sockets.forEach((s) => s.terminate()));
  function packet(socket, predicate) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off("message", message);
        reject(Error("Landing packet timed out"));
      }, 4000);
      function message(raw) {
        const p = JSON.parse(raw.toString());
        if (predicate(p)) {
          clearTimeout(timeout);
          socket.off("message", message);
          resolve(p);
        }
      }
      socket.on("message", message);
    });
  }
  async function join(id) {
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/flight`, {
      origin,
    });
    sockets.push(socket);
    const joined = packet(socket, (p) => p.type === "joined");
    await new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });
    socket.send(
      JSON.stringify({
        type: "join",
        physicsVersion: PHYSICS_VERSION,
        ticket: signFlightTicket({ id }, "landing-live", secret),
      }),
    );
    return { socket, joined: await joined };
  }
  const a = await join("landing-a"),
    b = await join("landing-b");
  const room = app.world.rooms.get("landing-live"),
    pilot = room.players.get("landing-a"),
    pad = getEarthLandingPad("pacific-1");
  pilot.position = pad.position.map((v, i) => v + pad.up[i] * 10);
  pilot.velocity = landingPadVelocity(pad.id);
  let response = packet(
    a.socket,
    (p) => p.type === "landing_result" && p.requestId === "land-1",
  );
  a.socket.send(
    JSON.stringify({
      type: "landing",
      revision: 0,
      requestId: "land-1",
      action: "land",
      padId: pad.id,
      position: [0, 0, 0],
    }),
  );
  assert((await response).ok);
  const visible = await packet(
    b.socket,
    (p) =>
      p.type === "state" &&
      p.state.players.some(
        (p) => p.id === "landing-a" && p.landedAt === pad.id,
      ),
  );
  assert(visible.state.players.find((p) => p.id === "landing-a").safeZone);
  response = packet(
    b.socket,
    (p) => p.type === "landing_result" && p.requestId === "spoof",
  );
  b.socket.send(
    JSON.stringify({
      type: "landing",
      revision: 0,
      requestId: "spoof",
      action: "takeoff",
      id: "landing-a",
      padId: pad.id,
    }),
  );
  assert.equal((await response).status, 409);
  assert.equal(pilot.landedAt, pad.id);
  response = packet(
    a.socket,
    (p) => p.type === "landing_result" && p.requestId === "depart",
  );
  a.socket.send(
    JSON.stringify({
      type: "landing",
      revision: 0,
      requestId: "depart",
      action: "takeoff",
    }),
  );
  assert((await response).ok);
  assert.equal(pilot.landedAt, null);
  assert.equal(pilot.token, a.joined.token);
  assert.equal(room.players.size, 2);
  pilot.position = [0, 0, 18];
  pilot.velocity = [0, 0, 0];
  const orientation = new Quaternion()
    .setFromAxisAngle(new Vector3(0, 0, 1), 0.4)
    .toArray();
  const shot = await fetch(`http://127.0.0.1:${address.port}/action`, {
    method: "POST",
    headers: {
      authorization: "Bearer " + secret,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      roomName: "landing-live",
      id: "landing-a",
      token: a.joined.token,
      action: {
        type: "fire",
        direction: [0, 0, 1],
        orientation,
        cannonIndex: 1,
        origin: [999, 999, 999],
      },
    }),
  });
  assert.equal(shot.status, 200);
  const expected = new Vector3(1.4, 0.05, 1.4)
    .applyQuaternion(new Quaternion(...orientation))
    .add(new Vector3(...pilot.position))
    .toArray();
  assert.equal(room.shots.at(-1).cannonIndex, 1);
  assert(distance(room.shots.at(-1).origin, expected) < .001);
});
