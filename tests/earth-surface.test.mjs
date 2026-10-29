import test from "node:test";
import assert from "node:assert/strict";
import { Mesh, MeshBasicMaterial, Raycaster, Vector3, Quaternion } from "three";
import {
  getEarthSurfaceState,
  earthSurfacePoint,
  earthSurfaceHeight,
  earthLandCoverage,
  getEarthSurfaceStatus,
  getEarthSurfaceDestinations,
  constrainEarthSurfaceFlight,
  constrainEarthCamera,
  EARTH_MAX_RELIEF,
} from "../lib/earthSurface.js";
import { createEarthSurfaceGeometry } from "../lib/earthSurfaceGeometry.js";
import { createPhysicsFrame } from "../lib/physics/world.js";
import { stepFrame } from "../lib/simCore/stepFrame.js";
import { CombatWorld } from "../lib/realtime/combatWorld.js";
import { SHIP_CONTACT_RADIUS } from "../lib/physics/mechanics.js";
const epoch = Date.UTC(2026, 9, 28),
  distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const earth = getEarthSurfaceState(epoch);
function local(lat, lon) {
  const a = (lat * Math.PI) / 180,
    b = (lon * Math.PI) / 180;
  return [Math.cos(a) * Math.cos(b), Math.sin(a), -Math.cos(a) * Math.sin(b)];
}
test("continuous terrain covers both hemispheres, poles and antimeridian with bounded relief", () => {
  for (let lat = -90; lat <= 90; lat += 3)
    for (let lon = -180; lon <= 180; lon += 3) {
      const h = earthSurfaceHeight(local(lat, lon));
      assert(h >= 0 && h < EARTH_MAX_RELIEF);
      const point = earthSurfacePoint(lat, lon, 12, epoch),
        status = getEarthSurfaceStatus(point, [0, 0, 0], epoch);
      assert(Math.abs(status.altitude - 12) < 1e-7);
      assert(status.active);
      assert(Math.abs(Math.hypot(...status.orientation) - 1) < 1e-8);
      assert(
        distance(
          new Vector3(0, 1, 0)
            .applyQuaternion(new Quaternion(...status.orientation))
            .toArray(),
          status.up,
        ) < 1e-8,
      );
    }
  for (let lat = -90; lat <= 90; lat += 5)
    assert(
      Math.abs(
        earthSurfaceHeight(local(lat, -180)) -
          earthSurfaceHeight(local(lat, 180)),
      ) < 1e-10,
    );
});
test("bundled coast mask retains oceans, continents and polar continuity", () => {
  assert(earthLandCoverage(local(0, -140)) < 0.02);
  for (const point of [
    [40, -100],
    [25, 15],
    [-25, 135],
  ])
    assert(earthLandCoverage(local(...point)) > 0.9);
  for (const lat of [-90, 90])
    assert(
      Math.abs(
        earthSurfaceHeight(local(lat, 0)) - earthSurfaceHeight(local(lat, 123)),
      ) < 1e-8,
    );
});
test("rendered mesh agrees with shared collision height over land, oceans and seams", () => {
  const geometry = createEarthSurfaceGeometry(earth.radius),
    mesh = new Mesh(geometry, new MeshBasicMaterial());
  mesh.scale.setScalar(earth.radius);
  mesh.updateMatrixWorld();
  // Offset rays from exact shared triangle edges to avoid raycaster vertex ambiguity.
  for (let lat = -84.9999; lat <= 85; lat += 10)
    for (let lon = -179.9999; lon < 180; lon += 15) {
      const dir = new Vector3(...local(lat, lon)),
        ray = new Raycaster(
          dir.clone().multiplyScalar(earth.radius + 20),
          dir.clone().negate(),
        );
      const hit = ray.intersectObject(mesh)[0];
      assert(hit, `missing mesh at ${lat},${lon}`);
      const expected = earth.radius + earthSurfaceHeight(dir.toArray());
      assert(
        Math.abs(hit.point.length() - expected) < 0.65,
        `${lat},${lon}: ${hit.point.length() - expected}`,
      );
    }
  geometry.dispose();
  mesh.material.dispose();
});
test("global surface contacts block descent and leave outward and tangential flight available", () => {
  for (const [lat, lon] of [
    [40, -100],
    [-25, 135],
    [0, -140],
    [80, 0],
    [-90, 0],
    [20, 179.9],
  ]) {
    const point = earthSurfacePoint(lat, lon, 0, epoch),
      status = getEarthSurfaceStatus(point, [0, 0, 0], epoch),
      v = status.up.map((v, i) => -v * 20 + status.north[i] * 4);
    const contact = constrainEarthSurfaceFlight(point, v, epoch);
    assert.equal(contact.contacts.length, 1);
    assert(
      getEarthSurfaceStatus(contact.position, [0, 0, 0], epoch).altitude >=
        SHIP_CONTACT_RADIUS - 1e-6,
    );
    assert(
      Math.abs(contact.velocity.reduce((s, v, i) => s + v * status.up[i], 0)) <
        1e-6,
    );
    assert(Math.hypot(...contact.velocity) > 3.99);
    const sky = earthSurfacePoint(lat, lon, 30, epoch),
      free = constrainEarthSurfaceFlight(
        sky,
        status.up.map((v) => v * 5),
        epoch,
      );
    assert.deepEqual(free.position, sky);
    assert(
      getEarthSurfaceStatus(
        constrainEarthCamera(point, epoch),
        [0, 0, 0],
        epoch,
      ).altitude >= 1.19,
    );
  }
});
test("swept terrain stops high speed through-planet approaches on the entry side", () => {
  for (const [lat, lon] of [
    [0, 0],
    [30, 20],
    [-40, 135],
    [90, 0],
  ]) {
    const from = earthSurfacePoint(lat, lon, 1000, epoch),
      up = getEarthSurfaceStatus(from, [0, 0, 0], epoch).up;
    const to = earth.position.map((v, i) => v - up[i] * 1000),
      hit = constrainEarthSurfaceFlight(
        to,
        up.map((v) => -v * 10000),
        epoch,
        from,
      );
    assert.equal(hit.contacts.length, 1);
    assert(
      getEarthSurfaceStatus(hit.position, [0, 0, 0], epoch).altitude >=
        SHIP_CONTACT_RADIUS - 1e-5,
    );
    assert(
      hit.position.reduce((s, v, i) => s + (v - earth.position[i]) * up[i], 0) >
        0,
    );
  }
});
test("surface state follows smooth UTC rotation and natural waypoints have no pads or buildings", () => {
  const destinations = getEarthSurfaceDestinations(epoch);
  assert.equal(destinations.length, 5);
  for (const target of destinations) {
    assert.equal(target.kind, "surface region");
    assert(!target.padId);
    assert(
      Math.abs(
        getEarthSurfaceStatus(target.position, [0, 0, 0], epoch).altitude - 22,
      ) < 1e-7,
    );
  }
  const a = earthSurfacePoint(25, 15, 0, epoch + 999),
    b = earthSurfacePoint(25, 15, 0, epoch + 1001);
  assert(distance(a, b) < 0.01);
  assert(distance(a, earthSurfacePoint(25, 15, 0, epoch + 3600000)) > 1000);
  assert(
    !createPhysicsFrame({ utcMs: epoch }).bodies.some((b) =>
      b.key.includes("structure"),
    ),
  );
});
test("prediction and authoritative worker share global ground constraints and reject retired docking", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: epoch });
  t.after(() => t.mock.timers.reset());
  const world = new CombatWorld(),
    joined = world.join("surface", { id: "pilot" }),
    pilot = world.rooms.get("surface").players.get("pilot");
  const point = earthSurfacePoint(-25, 135, SHIP_CONTACT_RADIUS + 1, epoch),
    up = getEarthSurfaceStatus(point, [0, 0, 0], epoch).up;
  pilot.position = point;
  pilot.velocity = up.map((v) => -v * 50);
  pilot.lastInput = epoch;
  pilot.control = [0, 0, 0];
  const predicted = stepFrame({
    position: point,
    velocity: pilot.velocity,
    controlVector: [0, 0, 0],
    dt: 0.05,
    utcMs: epoch + 50,
    gravitySources: world.rooms.get("surface").sources,
    worldSeed: "surface",
    diagnostics: false,
  });
  t.mock.timers.tick(50);
  world.tick();
  assert(distance(pilot.position, predicted.position) < 1e-7);
  assert(distance(pilot.velocity, predicted.velocity) < 1e-7);
  assert(
    getEarthSurfaceStatus(pilot.position, [0, 0, 0], epoch + 50).altitude >=
      SHIP_CONTACT_RADIUS - 1e-5,
  );
  const before = [...pilot.position];
  assert.equal(
    world.requestLanding("surface", "pilot", joined.token, "land", "pacific-1")
      .status,
    410,
  );
  assert.deepEqual(pilot.position, before);
  assert.equal(
    world.requestLanding("surface", "pilot", "forged", "land").status,
    401,
  );
  assert(pilot.safeZone);
  assert.equal(pilot.token, joined.token);
});
