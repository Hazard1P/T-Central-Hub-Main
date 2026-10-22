import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  rk4Step,
  sampleField,
  solarMu,
  muFromKilograms,
  schwarzschildRadius,
  KM_PER_UNIT,
  LIGHT_SPEED,
  distance,
} from "../lib/physics/mechanics.js";
import {
  sweepSphere,
  firstSphereContact,
  resolveStaticContacts,
  resolveBodyPairs,
} from "../lib/physics/collisions.js";
import { stepRigidBody } from "../lib/physics/rigidBody.js";
import { createPhysicsFrame, SOLAR_GM } from "../lib/physics/world.js";
import {
  stepFrame,
  buildGravitySourcesFromSeed,
} from "../lib/simCore/stepFrame.js";
import {
  stepShipState as legacyStep,
  sampleGravityAt,
} from "../lib/physicsEngine.js";
import { getUniverseSolarState } from "../lib/universeFlight.js";
const now = Date.UTC(2026, 9, 22),
  near = (a, b, tolerance = 1e-8) =>
    assert(Math.abs(a - b) <= tolerance, `${a} != ${b}`);

test("Newtonian field obeys inverse square, escape velocity and the radial tidal gradient", () => {
  const source = {
    key: "body",
    position: [0, 0, 0],
    mu: 100,
    physical: true,
    softening: 0.1,
  };
  const a = sampleField([10, 0, 0], [source], { diagnostics: true }),
    b = sampleField([20, 0, 0], [source], { diagnostics: true });
  near(a.acceleration[0], -1);
  near(a.acceleration[0] / b.acceleration[0], 4);
  near(a.nearest.tidal / b.nearest.tidal, 8);
  near(a.nearest.escapeVelocity, Math.sqrt(20));
  near(a.potential, -10);
  assert(sampleField([0, 0, 0], [source]).every(Number.isFinite));
});
test("physical Earth gravity and GEO orbital period are consistent in the universe scale", () => {
  const radiusKm = 6371,
    source = {
      key: "earth",
      position: [0, 0, 0],
      mu: solarMu(SOLAR_GM.earth),
      physical: true,
      softening: 1,
    };
  const gravity =
    Math.abs(sampleField([radiusKm / KM_PER_UNIT, 0, 0], [source])[0]) *
    KM_PER_UNIT *
    1000;
  near(gravity, 9.820250487, 1e-8);
  const r = 42164.169624086106 / KM_PER_UNIT,
    period = 2 * Math.PI * Math.sqrt(r ** 3 / source.mu);
  near(period, 86164.0905, 1e-5);
  near(
    schwarzschildRadius(solarMu(SOLAR_GM.sun)) * KM_PER_UNIT,
    2.95325008,
    1e-7,
  );
  const frame = createPhysicsFrame({
    utcMs: now,
    gravitySources: [
      { key: "physical-body", massKg: 5.9722e24, position: [0, 0, 0] },
    ],
  });
  const body = frame.sources.find((source) => source.key === "physical-body");
  assert.equal(body.mu, muFromKilograms(5.9722e24));
  assert(body.physical);
});
test("RK4 preserves a circular orbit, specific energy and angular momentum over ten revolutions", () => {
  const sources = [
      { position: [0, 0, 0], mu: 1, physical: true, softening: 0.01 },
    ],
    radius = 10,
    v = Math.sqrt(1 / radius),
    period = (2 * Math.PI * radius) / v;
  let p = [radius, 0, 0],
    velocity = [0, v, 0];
  for (let i = 0; i < 5000; i++) {
    const next = rk4Step(p, velocity, period / 500, (sample) =>
      sampleField(sample, sources),
    );
    p = next.position;
    velocity = next.velocity;
  }
  assert(distance(p, [radius, 0, 0]) < 0.00001);
  near(
    (velocity[0] ** 2 + velocity[1] ** 2) / 2 - 1 / Math.hypot(...p),
    -0.05,
    1e-9,
  );
  near(p[0] * velocity[1] - p[1] * velocity[0], radius * v, 1e-8);
});
test("rigid-body force, mass, torque and normalized orientation share the engine integrator", () => {
  const state = {
    mass: 2,
    radius: 1,
    position: [0, 0, 0],
    velocity: [1, 0, 0],
    orientation: [0, 0, 0, 1],
    angularVelocity: [0, 0, 0],
  };
  const next = stepRigidBody(state, {
    dt: 0.2,
    force: [4, 0, 0],
    torque: [0, 0, 4],
  });
  near(next.position[0], 0.24);
  near(next.velocity[0], 1.4);
  near(next.angularVelocity[2], 1);
  near(Math.hypot(...next.orientation), 1);
  assert(next.orientation[2] > 0);
  assert.deepEqual(state.position, [0, 0, 0]);
  assert.throws(
    () => stepRigidBody({ ...state, mass: 0 }, { dt: 0.1 }),
    /mass/,
  );
});
test("swept static contacts block tunneling and preserve tangential motion, including initial overlap", () => {
  const bodies = [{ key: "asteroid", position: [0, 0, 0], collisionRadius: 1 }];
  const hit = resolveStaticContacts({
    from: [-10, 0, 0],
    position: [10, 0, 0],
    velocity: [100, 2, 0],
    bodies,
  });
  assert(hit.position[0] < -1);
  near(hit.velocity[0], 0);
  near(hit.velocity[1], 2);
  assert.equal(hit.contacts[0].key, "asteroid");
  assert.equal(sweepSphere([0, 0, 0], [0, 0, 0], [0, 0, 0], 1).time, 0);
  const overlap = resolveStaticContacts({
    from: [0, 0, 0],
    position: [0, 0, 0],
    velocity: [1, 0, 0],
    bodies,
  });
  assert(overlap.position.every(Number.isFinite));
  assert(Math.hypot(...overlap.position) >= 1);
});
test("ship contact conserves momentum, bounds restitution and catches fast crossing bodies", () => {
  const bodies = [
    {
      id: "a",
      mass: 2,
      radius: 1,
      previousPosition: [-10, 0, 0],
      position: [10, 0, 0],
      velocity: [100, 0, 0],
    },
    {
      id: "b",
      mass: 1,
      radius: 1,
      previousPosition: [10, 0, 0],
      position: [-10, 0, 0],
      velocity: [-100, 0, 0],
    },
  ];
  const before = bodies.reduce((n, b) => n + b.mass * b.velocity[0], 0),
    energy = bodies.reduce((n, b) => n + (b.mass * b.velocity[0] ** 2) / 2, 0);
  assert.equal(resolveBodyPairs(bodies, 0.2).length, 1);
  near(
    bodies.reduce((n, b) => n + b.mass * b.velocity[0], 0),
    before,
  );
  assert(
    bodies.reduce((n, b) => n + (b.mass * b.velocity[0] ** 2) / 2, 0) <= energy,
  );
  assert(bodies[0].position[0] < bodies[1].position[0]);
  assert(distance(bodies[0].position, bodies[1].position) >= 2);
});
test("explicit UTC gives deterministic replay and adds every physical body without a duplicate Sun", (t) => {
  const args = {
    position: [4000000, 500, 20000],
    velocity: [1, 2, 3],
    controlVector: [0, 0, 1],
    dt: 0.05,
    utcMs: now,
    gravitySources: buildGravitySourcesFromSeed("same"),
  };
  const a = stepFrame(args);
  t.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2040, 0, 1) });
  t.after(() => t.mock.timers.reset());
  assert.deepEqual(stepFrame(args), a);
  const sources = createPhysicsFrame({
    utcMs: now,
    gravitySources: args.gravitySources,
  }).sources;
  assert.equal(sources.filter((s) => s.key === "solar-sun").length, 1);
  assert.equal(sources.filter((s) => s.key.startsWith("solar-")).length, 11);
  assert(!sources.some((s) => s.key === "solar_system"));
});
test("legacy THREE path and current flight use identical forces and have no old map boundary", () => {
  const args = {
    position: [1000000, 500, 20000],
    velocity: [1, 2, 3],
    controlVector: [0, 0, 1],
    dt: 0.05,
    utcMs: now,
    gravitySources: buildGravitySourcesFromSeed("legacy"),
  };
  const a = stepFrame(args),
    b = legacyStep({
      ...args,
      position: new THREE.Vector3(...args.position),
      velocity: new THREE.Vector3(...args.velocity),
      inputVector: new THREE.Vector3(...args.controlVector),
    });
  assert.deepEqual(b.position.toArray(), a.position);
  assert.deepEqual(b.velocity.toArray(), a.velocity);
  assert(a.position[0] > 999999);
  assert.deepEqual(
    sampleGravityAt(
      new THREE.Vector3(...a.position),
      args.gravitySources,
      now,
    ).acceleration.toArray(),
    a.gravity,
  );
});
test("vacuum coasting preserves velocity and small real planetary acceleration survives integration precision", () => {
  const frame = { utcMs: now, sources: [], bodies: [], obstacles: [] };
  const a = stepFrame({
    position: [0, 0, 0],
    velocity: [1, 2, 3],
    controlVector: [0, 0, 0],
    dt: 0.2,
    physicsFrame: frame,
  });
  assert.deepEqual(a.velocity, [1, 2, 3]);
  near(a.position[0], 0.2);
  const earth = getUniverseSolarState(now).find((b) => b.id === "earth");
  const p = earth.position.map(
    (v, i) => v + (i === 0 ? earth.radius * 3.3 : 0),
  );
  const next = stepFrame({
    position: p,
    velocity: [0, 0, 0],
    controlVector: [0, 0, 0],
    dt: 0.05,
    utcMs: now,
    gravitySources: [{ mass: 0, position: [0, 0, 0] }],
  });
  assert(Math.hypot(...next.velocity) > 0);
  assert(Math.hypot(...next.velocity) < 0.0001);
  assert(next.gravity.every(Number.isFinite));
});
test("relativistic diagnostics stay separate from assisted travel and reject unsupported regimes", () => {
  const a = sampleField([10, 0, 0], [], {
    diagnostics: true,
    velocity: [LIGHT_SPEED * 0.8, 0, 0],
  });
  near(a.relativity.properTimeRate, 0.6);
  const b = sampleField([10, 0, 0], [], {
    diagnostics: true,
    velocity: [LIGHT_SPEED * 2, 0, 0],
  });
  assert.equal(b.relativity.properTimeRate, null);
  const weak = sampleField(
    [10, 0, 0],
    [{ position: [0, 0, 0], mu: 1, physical: true, softening: 0.1 }],
    { diagnostics: true },
  );
  assert(weak.relativity.properTimeRate < 1);
});

test("generated stellar masses drive their fields and stay consistent across shared room seeds", () => {
  const a = createPhysicsFrame({
      utcMs: now,
      gravitySources: buildGravitySourcesFromSeed("star-a"),
    }),
    b = createPhysicsFrame({
      utcMs: now,
      gravitySources: buildGravitySourcesFromSeed("star-b"),
    });
  const star = a.sources.find((s) => s.key === "ember_star"),
    other = b.sources.find((s) => s.key === "ember_star");
  near(star.mu, solarMu(SOLAR_GM.sun) * star.stellarProfile.massSolar);
  assert.equal(star.mu, other.mu);
  assert(star.physical);
});

test("sliding sweeps the remaining path against a second obstacle deterministically", () => {
  const bodies = [
    { key: "first", position: [0, 0, 0], collisionRadius: 1 },
    { key: "second", position: [0.84, 1.88, 0], collisionRadius: 0.3 },
  ];
  const args = { from: [-3, 0, 0], position: [3, 2, 0], velocity: [60, 20, 0] };
  const hit = resolveStaticContacts({ ...args, bodies });
  assert(hit.contacts.some((c) => c.key === "first"));
  assert(
    hit.contacts.some((c) => c.key === "second"),
    "slide must not tunnel through the second sphere",
  );
  assert.deepEqual(
    resolveStaticContacts({ ...args, bodies: [...bodies].reverse() }),
    hit,
  );
  for (const b of bodies)
    assert(distance(hit.position, b.position) >= b.collisionRadius);
});

test("ships already touching do not cross through each other on the next fast step", () => {
  const bodies = [
    {
      id: "a",
      mass: 1,
      radius: 1,
      previousPosition: [-1, 0, 0],
      position: [9, 0, 0],
      velocity: [100, 0, 0],
    },
    {
      id: "b",
      mass: 1,
      radius: 1,
      previousPosition: [1, 0, 0],
      position: [-9, 0, 0],
      velocity: [-100, 0, 0],
    },
  ];
  assert.equal(resolveBodyPairs(bodies, 0.1).length, 1);
  assert(bodies[0].position[0] < bodies[1].position[0]);
  near(bodies[0].velocity[0] + bodies[1].velocity[0], 0);
  assert(distance(bodies[0].position, bodies[1].position) >= 2);
});

test("shared flight reserves the full ship contact radius at celestial surfaces", () => {
  const frame = {
    utcMs: now,
    sources: [],
    obstacles: [],
    bodies: [{ key: "surface", position: [0, 0, 0], collisionRadius: 1 }],
  };
  const next = stepFrame({
    position: [-5, 0, 0],
    velocity: [20, 0, 0],
    controlVector: [0, 0, 0],
    dt: 0.2,
    physicsFrame: frame,
  });
  assert(
    next.position[0] <= -4.2,
    "ship radius must use the same 3.2 units as multiplayer contacts",
  );
  near(next.velocity[0], 0);
});

test("deep-space sphere sweeps retain small target entry points over billion-unit segments", () => {
  const hit = sweepSphere([-1e9, 0, 0], [1e9, 0, 0], [0, 0, 0], 1);
  near(hit.point[0], -1, 1e-7);
  assert.equal(sweepSphere([-1e9, 2, 0], [1e9, 2, 0], [0, 0, 0], 1), null);
  const far = resolveStaticContacts({
    from: [1e9 - 3, 0, 0],
    position: [1e9 + 3, 0, 0],
    velocity: [10, 0, 0],
    bodies: [{ key: "distant", position: [1e9, 0, 0], collisionRadius: 1 }],
  });
  assert(far.position[0] < 1e9 - 1);
  assert(
    far.contacts.length <= 2,
    "representable contact slop avoids repeated zero-time hits",
  );
});


test('first contact follows surface entry and stable identity, rather than center distance or catalog order', () => {
  const bodies=[{id:'small',position:[10,0,0],radius:1},{id:'large',position:[12,0,0],radius:5}];
  const hit=firstSphereContact([0,0,0],[100,0,0],bodies);
  assert.equal(hit.body.id,'large');near(hit.point[0],7);
  assert.deepEqual(firstSphereContact([0,0,0],[100,0,0],[...bodies].reverse()),hit);
  const tied=[{id:'z',position:[10,0,0],radius:1},{id:'a',position:[10,0,0],radius:1}];
  assert.equal(firstSphereContact([0,0,0],[100,0,0],tied).body.id,'a');
});
