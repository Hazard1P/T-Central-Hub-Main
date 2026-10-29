import test from "node:test";
import assert from "node:assert/strict";
import { flightSubsteps, flightTimeline } from "../lib/universeSpace.js";
import { getUniverseSolarState } from "../lib/universeSolarState.js";
import {
  getEarthSurfaceState,
  earthSurfacePoint,
  earthSurfaceVelocity,
  getEarthSurfaceStatus,
} from "../lib/earthSurface.js";
import { resolveStaticContacts } from "../lib/physics/collisions.js";
import { createPhysicsFrame, physicsFrameAt } from "../lib/physics/world.js";
import { stepRigidBody } from "../lib/physics/rigidBody.js";
import { stepFrame } from "../lib/simCore/stepFrame.js";
import { advanceFlightBatch } from "../lib/simCore/flightBatch.js";
import {
  replayFlightInputs,
  MAX_PREDICTION_FRAMES,
} from "../lib/simCore/prediction.js";
import { SHIP_CONTACT_RADIUS } from "../lib/physics/mechanics.js";
const epoch = Date.UTC(2026, 9, 29),
  distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const near = (a, b, e = 1e-8) => assert(Math.abs(a - b) <= e, `${a} != ${b}`);

test("30 through 1000 Hz displays simulate exactly the elapsed interval, including zero and resume frames", () => {
  for (const fps of [30, 60, 120, 144, 240, 360, 500, 1000]) {
    let time = 0;
    for (let i = 0; i < fps; i++)
      time += flightSubsteps(1 / fps).reduce((a, b) => a + b, 0);
    near(time, 1, 1e-12);
  }
  assert.deepEqual(flightSubsteps(0), []);
  assert.deepEqual(flightSubsteps(-0.2), []);
  near(
    flightSubsteps(2).reduce((a, b) => a + b, 0),
    0.25,
    1e-12,
  );
  for (const delta of [1 / 360, 1 / 30, 0.25]) {
    const timeline = flightTimeline(delta, epoch);
    assert.equal(timeline.at(-1).utcMs, epoch);
    near(
      timeline[0].utcMs - timeline[0].dt * 1000,
      epoch - delta * 1000,
      0.001,
    );
    for (let i = 1; i < timeline.length; i++)
      near(
        timeline[i].utcMs - timeline[i].dt * 1000,
        timeline[i - 1].utcMs,
        0.001,
      );
  }
});
test("vacuum coasting covers the same distance at different display rates", () => {
  for (const fps of [30, 60, 144, 360, 500]) {
    let position = [500, 100, 20],
      velocity = [3, -2, 1];
    for (let i = 0; i < fps; i++)
      for (const sample of flightTimeline(
        1 / fps,
        epoch + ((i + 1) * 1000) / fps,
      )) {
        const result = stepFrame({
          position,
          velocity,
          controlVector: [0, 0, 0],
          ...sample,
          physicsFrame: {
            utcMs: sample.utcMs,
            sources: [],
            bodies: [],
            obstacles: [],
          },
          diagnostics: false,
        });
        position = result.position;
        velocity = result.velocity;
      }
    assert(distance(position, [503, 98, 21]) < 1e-8);
    assert.deepEqual(velocity, [3, -2, 1]);
  }
});
test("continuous Solar states and velocities agree with independent endpoint interpolation across a UTC second", () => {
  for (const id of ["earth", "moon", "mercury", "jupiter"]) {
    const a = getUniverseSolarState(epoch).find((x) => x.id === id),
      b = getUniverseSolarState(epoch + 1000).find((x) => x.id === id),
      mid = getUniverseSolarState(epoch + 250).find((x) => x.id === id);
    assert(
      distance(
        mid.position,
        a.position.map((v, i) => v + (b.position[i] - v) * 0.25),
      ) < 1e-8,
    );
    assert(
      distance(
        mid.velocity,
        b.position.map((v, i) => v - a.position[i]),
      ) < 1e-8,
    );
    const before = getUniverseSolarState(epoch + 999).find((x) => x.id === id),
      after = getUniverseSolarState(epoch + 1001).find((x) => x.id === id);
    assert(
      distance(before.position, after.position) <
        Math.hypot(...mid.velocity) * 0.003 + 0.00001,
    );
    const { x, y, z } = mid.orientation;
    for (const axis of [x, y, z]) near(Math.hypot(...axis), 1, 1e-12);
    near(
      x.reduce((s, v, i) => s + v * y[i], 0),
      0,
      1e-12,
    );
  }
  assert.deepEqual(
    getEarthSurfaceState(epoch + 250).position,
    getUniverseSolarState(epoch + 250).find((b) => b.id === "earth").position,
  );
});
test("a moving body can sweep into a stationary ship and carry the blocked normal displacement", () => {
  const body = {
    key: "moving",
    position: [10, 0, 0],
    velocity: [100, 0, 0],
    collisionRadius: 1,
  };
  const result = resolveStaticContacts({
    from: [0, 0, 0],
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    bodies: [body],
    dt: 0.2,
  });
  near(result.position[0], 11, 1e-5);
  near(result.velocity[0], 100);
  near(result.contacts[0].impactSpeed, 100);
  assert(result.position.every(Number.isFinite));
});
test("moving contact is Galilean invariant and preserves tangential motion without vacuum drag", () => {
  const from = [-5, 0, 0],
    to = [5, 0, 0],
    velocity = [50, 2, 0],
    body = {
      key: "sphere",
      position: [0, 0, 0],
      collisionRadius: 1,
      velocity: [0, 0, 0],
    },
    boost = [7, -3, 5],
    dt = 0.2;
  const a = resolveStaticContacts({
    from,
    position: to,
    velocity,
    bodies: [body],
    dt,
  });
  const b = resolveStaticContacts({
    from,
    position: to.map((v, i) => v + boost[i] * dt),
    velocity: velocity.map((v, i) => v + boost[i]),
    bodies: [
      {
        ...body,
        position: body.position.map((v, i) => v + boost[i] * dt),
        velocity: boost,
      },
    ],
    dt,
  });
  assert(
    distance(
      b.position,
      a.position.map((v, i) => v + boost[i] * dt),
    ) < 1e-6,
  );
  assert(
    distance(
      b.velocity,
      a.velocity.map((v, i) => v + boost[i]),
    ) < 1e-8,
  );
  near(a.velocity[1], 2);
});
test("moving gravity uses RK stage time rather than freezing a source at the tick endpoint", () => {
  const dt = 0.2,
    source = {
      key: "moving-mass",
      position: [0, 0, 0],
      velocity: [20, 0, 0],
      mu: 100,
      physical: true,
      softening: 0.01,
    },
    frame = { utcMs: epoch, sources: [source], bodies: [], obstacles: [] };
  const result = stepFrame({
    position: [10, 10, 0],
    velocity: [0, 0, 0],
    controlVector: [0, 0, 0],
    dt,
    physicsFrame: frame,
  });
  // Independent fine-step midpoint reference, with an explicitly prescribed x(t).
  let p = [10, 10, 0],
    v = [0, 0, 0];
  const h = dt / 10000;
  const acceleration = (point, t) => {
    const d = [20 * (t - dt) - point[0], -point[1], -point[2]],
      r = Math.hypot(...d);
    return d.map((x) => (100 * x) / r ** 3);
  };
  for (let i = 0; i < 10000; i++) {
    const t = i * h,
      a = acceleration(p, t),
      midP = p.map((x, j) => x + (v[j] * h) / 2),
      midV = v.map((x, j) => x + (a[j] * h) / 2),
      midA = acceleration(midP, t + h / 2);
    p = p.map((x, j) => x + midV[j] * h);
    v = v.map((x, j) => x + midA[j] * h);
  }
  assert(distance(result.position, p) < 1e-7);
  assert(distance(result.velocity, v) < 1e-7);
  const rigid = stepRigidBody(
    { position: [10, 10, 0], velocity: [0, 0, 0], mass: 1, radius: 1 },
    { dt, sources: [source] },
  );
  assert(distance(rigid.position, p) < 1e-7);
  assert(distance(rigid.velocity, v) < 1e-7);
  const earlier = physicsFrameAt(frame, epoch - 100);
  assert.deepEqual(earlier.sources[0].position, [-2, 0, 0]);
  assert.deepEqual(source.position, [0, 0, 0]);
  assert.throws(() => physicsFrameAt(frame, NaN), /finite UTC/);
});
test("Earth surface contact follows the same continuous moving frame across a UTC second", () => {
  const start = epoch + 990,
    end = start + 50,
    position = earthSurfacePoint(25, 15, SHIP_CONTACT_RADIUS - 1e-6, start),
    velocity = earthSurfaceVelocity(position, start);
  const result = stepFrame({
    position,
    velocity,
    controlVector: [0, 0, 0],
    dt: 0.05,
    utcMs: end,
    gravitySources: [{ key: "zero", position: [0, 0, 0], mass: 0 }],
  });
  const status = getEarthSurfaceStatus(result.position, result.velocity, end);
  assert(status.altitude >= SHIP_CONTACT_RADIUS - 1e-7);
  assert(status.altitude < SHIP_CONTACT_RADIUS + 0.0001);
  const reference = earthSurfacePoint(25, 15, SHIP_CONTACT_RADIUS, end);
  assert(distance(result.position, reference) < 0.0001);
  const surfaceVelocity = earthSurfaceVelocity(result.position, end),
    relative = result.velocity.map((v, i) => v - surfaceVelocity[i]);
  assert(relative.reduce((sum, v, i) => sum + v * status.up[i], 0) > -0.00001);
});
test("high-refresh replay retains more than 120 inputs and advances epochs from the authoritative endpoint", () => {
  assert(MAX_PREDICTION_FRAMES >= 300);
  const frames = Array.from({ length: 150 }, (_, i) => ({
    frameIndex: i + 1,
    dt: 1 / 500,
    controlVector: [0, 0, 0],
  }));
  const result = replayFlightInputs({
    frames,
    authoritativePosition: [400000000, 400000000, 400000000],
    authoritativeVelocity: [5, 0, 0],
    utcMs: epoch,
    gravitySources: [{ key: "zero", position: [0, 0, 0], mass: 0 }],
  });
  assert(
    result.position[0] > 400000001.49 && result.position[0] < 400000001.51,
  );
  near(result.physics.utcMs, epoch + 300, 0.001);
});
test("HTTP batches accept high-refresh steps within server time, reject replay, and ignore submitted clock values", () => {
  const inputs = Array.from({ length: 36 }, (_, i) => ({
    frameIndex: i + 1,
    dt: 1 / 360,
    controlVector: [0, 0, 0],
    utcMs: 0,
  }));
  const args = {
    position: [400000000, 400000000, 400000000],
    velocity: [5, 0, 0],
    elapsed: 0.1,
    utcMs: epoch,
    snapshot: { inputs, utcMs: 0 },
    gravitySources: [{ key: "zero", position: [0, 0, 0], mass: 0 }],
  };
  const result = advanceFlightBatch(args);
  assert.equal(result.frameIndex, 36);
  near(result.physics.utcMs, epoch, 0.001);
  assert(
    result.position[0] > 400000000.49 && result.position[0] < 400000000.51,
  );
  const fast = advanceFlightBatch({
    ...args,
    elapsed: 0.25,
    snapshot: {
      inputs: Array.from({ length: 125 }, (_, i) => ({
        frameIndex: i + 1,
        dt: 1 / 500,
        controlVector: [0, 0, 0],
      })),
    },
  });
  assert.equal(fast.frameIndex, 125);
  near(fast.physics.utcMs, epoch, 0.001);
  const replay = advanceFlightBatch({
    ...args,
    position: result.position,
    velocity: result.velocity,
    frameIndex: 36,
  });
  assert.deepEqual(replay.position, result.position);
  const denied = advanceFlightBatch({ ...args, elapsed: 0 });
  assert.equal(denied.frameIndex, 0);
  assert.equal(
    advanceFlightBatch({
      ...args,
      elapsed: 0,
      snapshot: {
        inputs: [{ frameIndex: 1, dt: 1e-6, controlVector: [0, 0, 1] }],
      },
    }).frameIndex,
    0,
  );
  assert.deepEqual(denied.position, args.position);
});

test("a moving safe-zone boundary intercepts a pulse even when its endpoint sphere misses", async () => {
  const { earthSafeZoneContact } = await import("../lib/earthSafeZone.js");
  const zone = {
    id: "test-zone",
    position: [5, 0, 0],
    velocity: [100, 0, 0],
    radius: 0.5,
  };
  assert.equal(earthSafeZoneContact([0, 0, 0], [0, 0, 0], epoch, zone), null);
  assert(earthSafeZoneContact([0, 0, 0], [0, 0, 0], epoch, zone, 0.1));
});
test("a pulse cannot hit a target that crossed its position before the pulse existed", async (t) => {
  const { CombatWorld } = await import("../lib/realtime/combatWorld.js"),
    { createPulseShot } = await import("../lib/shipWeapons.js");
  t.mock.timers.enable({ apis: ["Date"], now: epoch });
  t.after(() => t.mock.timers.reset());
  function run(createdOffset) {
    const world = new CombatWorld({ now: epoch });
    world.join("partial", { id: "a" }, epoch);
    world.join("partial", { id: "b" }, epoch);
    const room = world.rooms.get("partial"),
      a = room.players.get("a"),
      b = room.players.get("b"),
      origin = [400000000, 400000000, 400000000];
    a.position = origin.map((v, i) => v + (i === 2 ? -500 : 0));
    a.velocity = [0, 0, 0];
    a.lastInput = epoch;
    b.position = origin.map((v, i) => v + (i === 1 ? -10 : 0));
    b.velocity = [0, 400, 0];
    b.lastInput = epoch;
    b.invulnerableUntil = 0;
    const shot = createPulseShot({
      origin,
      direction: [0, 0, 1],
      inheritedVelocity: [0, 0, -64],
      now: epoch + createdOffset,
      id: "partial-shot",
      ownerId: "a",
    });
    room.shots.push({ ...shot, position: [...origin] });
    world.tick(epoch + 50);
    return { b, room };
  }
  const late = run(40);
  assert.equal(late.b.shield, 60);
  assert.equal(late.room.shots.length, 1);
  assert.equal(late.room.shots[0].updatedAt, epoch + 50);
  const early = run(10);
  assert.equal(early.b.shield, 40);
  assert.equal(early.room.shots.length, 0);
});
