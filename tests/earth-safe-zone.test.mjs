import test from "node:test";
import assert from "node:assert/strict";
import { Quaternion, Euler, Vector3 } from "three";
import {
  getEarthSafeZone,
  isInEarthSafeZone,
  earthSafeZoneContact,
} from "../lib/earthSafeZone.js";
import { getSolarSpawn, getEarthMiningField } from "../lib/universeFlight.js";
import { SHIP_CONTACT_RADIUS } from "../lib/physics/mechanics.js";
import { CombatWorld, PULSE_DAMAGE } from "../lib/realtime/combatWorld.js";
import {
  createShipPulse,
  createPulseShot,
  SHIP_CANNON_MUZZLES,
} from "../lib/shipWeapons.js";

const epoch = Date.UTC(2026, 9, 28);
function fixture(t) {
  t.mock.timers.enable({ apis: ["Date"], now: epoch });
  t.after(() => t.mock.timers.reset());
  const world = new CombatWorld(),
    a = world.join("safe", { id: "a" }),
    b = world.join("safe", { id: "b" });
  const room = world.rooms.get("safe"),
    shooter = room.players.get("a"),
    target = room.players.get("b");
  const zone = getEarthSafeZone();
  const at = (x, y = 0, z = 0) => zone.position.map((v, i) => v + [x, y, z][i]);
  function advance(ms) {
    for (let n = 0; n < ms; n += 50) {
      t.mock.timers.tick(50);
      world.tick();
    }
  }
  return { world, a, b, room, shooter, target, zone, at, advance };
}

test("the Earth safe sphere follows UTC Earth, contains spawns and repairs, and leaves mining outside", () => {
  for (const time of [epoch, epoch + 86400000 * 100]) {
    const zone = getEarthSafeZone(time),
      { earth, center } = getEarthMiningField(time);
    assert.deepEqual(zone.position, earth.position);
    for (let n = 0; n < 200; n++)
      assert(isInEarthSafeZone(getSolarSpawn("pilot-" + n, time), time));
    assert(
      isInEarthSafeZone(
        earth.position.map((v, i) => v + (i === 0 ? earth.radius * 4.2 : 0)),
        time,
      ),
    );
    assert(!isInEarthSafeZone(center, time));
    assert(!isInEarthSafeZone([NaN, 0, 0], time));
  }
  assert.notDeepEqual(
    getEarthSafeZone(epoch).position,
    getEarthSafeZone(epoch + 86400000).position,
  );
});

test("the inclusive boundary protects the whole ship and sweeps intercept crossing and tangent pulses", () => {
  const zone = { position: [0, 0, 0], radius: 100 },
    edge = zone.radius + SHIP_CONTACT_RADIUS;
  assert(isInEarthSafeZone([edge, 0, 0], epoch, zone));
  assert(!isInEarthSafeZone([edge + 0.001, 0, 0], epoch, zone));
  assert(earthSafeZoneContact([-200, 0, 0], [200, 0, 0], epoch, zone));
  assert(earthSafeZoneContact([-200, edge, 0], [200, edge, 0], epoch, zone));
  assert(
    !earthSafeZoneContact([-200, edge + 1, 0], [200, edge + 1, 0], epoch, zone),
  );
});

test("server spawn and respawn protection cannot be spent on safe-zone firing, including internal fire calls", (t) => {
  const { world, a, room, shooter, advance } = fixture(t);
  const protection = shooter.invulnerableUntil;
  for (let n = 0; n < 3; n++) {
    assert.equal(
      world.requestFire("safe", "a", a.token, [1, 0, 0]).error,
      "EARTH_SAFE_ZONE",
    );
    world.fire(room, shooter, Date.now());
  }
  assert.equal(room.shots.length, 0);
  assert.equal(shooter.lastShot, 0);
  assert.equal(shooter.invulnerableUntil, protection);
  shooter.alive = false;
  shooter.respawnAt = Date.now() + 50;
  advance(50);
  assert(shooter.alive);
  assert(isInEarthSafeZone(shooter.position));
  assert(
    world
      .state("safe", "a", shooter.token)
      .state.players.find((p) => p.id === "a").safeZone,
  );
  assert.equal(
    world.requestFire("safe", "a", shooter.token, [1, 0, 0]).error,
    "EARTH_SAFE_ZONE",
  );
});

test("safe-zone occupants cannot damage others or be damaged through a direct server damage path", (t) => {
  const { world, room, shooter, target, zone, at } = fixture(t);
  shooter.position = at(zone.radius + 100);
  target.position = getSolarSpawn("target");
  assert.equal(world.damage(room, target, shooter, Date.now()), false);
  target.position = at(zone.radius + 200);
  shooter.position = getSolarSpawn("shooter");
  assert.equal(world.damage(room, target, shooter, Date.now()), false);
  assert.equal(target.shield, 60);
  assert.equal(target.health, 100);
  assert.equal(room.events.length, 0);
});

test("leaving Earth enables real combat; returning locks weapons and intercepts incoming fire", (t) => {
  const { world, a, room, shooter, target, zone, at, advance } = fixture(t);
  shooter.position = at(zone.radius + 100);
  target.position = at(zone.radius + 135);
  target.invulnerableUntil = 0;
  assert(world.requestFire("safe", "a", a.token, [1, 0, 0]).ok);
  advance(800);
  assert.equal(target.shield, 60 - PULSE_DAMAGE);
  target.position = at(zone.radius - 20);
  target.shield = 60;
  assert(world.requestFire("safe", "a", a.token, [-1, 0, 0]).ok);
  advance(2200);
  assert.equal(target.shield, 60);
  assert.equal(room.shots.length, 0);
  shooter.position = getSolarSpawn("a");
  assert.equal(
    world.requestFire("safe", "a", a.token, [1, 0, 0]).error,
    "EARTH_SAFE_ZONE",
  );
});

test("a fast projectile cannot traverse the protected sphere between two outside samples", (t) => {
  const { world, room, shooter, zone, at, advance } = fixture(t);
  shooter.position = at(-zone.radius * 2, zone.radius * 0.8);
  const shot = createPulseShot({
    origin: shooter.position,
    direction: [1, 0, 0],
    inheritedVelocity: [zone.radius * 100, 0, 0],
    now: Date.now(),
    id: "crossing",
    ownerId: "a",
  });
  room.shots.push({ ...shot, position: [...shot.origin] });
  advance(50);
  assert.equal(room.shots.length, 0);
});

test("cannon origins match the real rendered barrel tips across yaw, pitch, bank and both sides", () => {
  const position = [4000000, 2000, -1900000];
  for (const angles of [
    [0, 0, 0],
    [0.3, 1.1, 0.6],
    [-0.8, -2.4, -0.4],
    [Math.PI, 0, 0],
  ]) {
    const q = new Quaternion().setFromEuler(new Euler(...angles, "YXZ"));
    const direction = new Vector3(0, 0, 1).applyQuaternion(q).toArray();
    for (let cannonIndex = 0; cannonIndex < 2; cannonIndex++) {
      const shot = createShipPulse({
        position,
        direction,
        orientation: q.toArray(),
        cannonIndex,
        now: epoch,
      });
      const tip = new Vector3(...SHIP_CANNON_MUZZLES[cannonIndex])
        .applyQuaternion(q)
        .add(new Vector3(...position))
        .toArray();
      assert.deepEqual(shot.origin, tip);
      assert.equal(shot.cannonIndex, cannonIndex);
      assert(Math.hypot(...shot.origin.map((v, i) => v - position[i])) < 3.2);
    }
  }
  for (const pose of [
    { orientation: [0, 0, 0, 100] },
    { orientation: [0, 0, 0, 0] },
    { orientation: [0, NaN, 0, 1] },
    { cannonIndex: 99 },
  ])
    assert.equal(
      createShipPulse({ position, direction: [0, 0, 1], now: epoch, ...pose }),
      null,
    );
});

test("the server constrains client cannon poses to fixed offsets and keeps snapshot orientation private from mutation", (t) => {
  const { world, a, room, shooter, zone, at } = fixture(t);
  shooter.position = at(zone.radius + 200);
  assert.equal(
    world.requestFire("safe", "a", a.token, [0, 0, 1], Date.now(), {
      orientation: [0, 0, 0, 100],
    }).error,
    "INVALID_CANNON_POSE",
  );
  assert.equal(room.shots.length, 0);
  const q = new Quaternion().setFromEuler(new Euler(0.2, 0.7, 0.5)).toArray();
  assert(
    world.input("safe", "a", a.token, {
      frameIndex: 1,
      controlVector: [0, 0, 0],
      direction: [0, 0, 1],
      orientation: q,
    }),
  );
  const pose = { orientation: q, cannonIndex: 1 };
  assert(
    world.requestFire("safe", "a", a.token, [0, 0, 1], Date.now(), pose).ok,
  );
  const expected = createShipPulse({
    position: shooter.position,
    direction: [0, 0, 1],
    now: Date.now(),
    ...pose,
  });
  assert.deepEqual(room.shots[0].origin, expected.origin);
  const state = world.state("safe", "a", a.token).state;
  assert.equal(state.projectiles[0].cannonIndex, 1);
  assert.deepEqual(state.projectiles[0].origin, expected.origin);
  assert(Object.isFrozen(state.players.find((p) => p.id === "a").orientation));
});
