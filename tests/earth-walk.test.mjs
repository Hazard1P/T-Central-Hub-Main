import test from "node:test";
import assert from "node:assert/strict";
import { Raycaster, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { CombatWorld } from "../lib/realtime/combatWorld.js";
import {
  getEarthSurfaceState,
  earthSurfacePoint,
  getEarthSurfaceStatus,
  earthLocalVector,
  earthWorldVector,
  earthSurfaceHeight,
} from "../lib/earthSurface.js";
import {
  earthAnchorAt,
  earthAnchoredPose,
  validateEarthWalk,
  stepEarthWalk,
  boardEarthShip,
  earthAnchorDistance,
  earthPointVelocity,
  WALK_EYE_HEIGHT,
  METRES_PER_UNIT,
} from "../lib/earthWalk.js";
import { createEarthSurfaceGeometry } from "../lib/earthSurfaceGeometry.js";
import { createLocalEarthTerrain } from "../lib/earthLocalTerrain.js";
const epoch = Date.UTC(2026, 9, 28),
  distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const ground = earthSurfacePoint(25, 15, 0, epoch),
  anchor = earthAnchorAt(ground, epoch);
function fixture(t) {
  t.mock.timers.enable({ apis: ["Date"], now: epoch });
  t.after(() => t.mock.timers.reset());
  const world = new CombatWorld(),
    join = world.join("walking", { id: "walker" }),
    p = world.rooms.get("walking").players.get("walker");
  p.position = earthSurfacePoint(25, 15, 4, epoch);
  p.velocity = earthPointVelocity(anchor, 4, epoch);
  return { world, p, join };
}
test("orbital Earth keeps its circular silhouette with physically bounded relief", () => {
  const radius = getEarthSurfaceState(epoch).radius,
    g = createEarthSurfaceGeometry(radius),
    pos = g.attributes.position;
  let min = Infinity,
    max = 0;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i));
    min = Math.min(min, r);
    max = Math.max(max, r);
  }
  assert(min > 0.999999);
  assert(max < 1.0011);
  assert((max - min) * 300 < 0.34);
  g.dispose();
});
test("leaving a ship requires dry ground, low approach altitude and relative speed", () => {
  const position = earthSurfacePoint(25, 15, 4, epoch),
    velocity = earthPointVelocity(anchor, 4, epoch);
  const result = validateEarthWalk(position, velocity, epoch);
  assert(result.ok);
  assert(
    Math.abs(
      earthAnchorDistance(result.walkAnchor, result.parkedShip.anchor, epoch) *
        METRES_PER_UNIT -
        18,
    ) < 0.02,
  );
  assert(
    !validateEarthWalk(earthSurfacePoint(25, 15, 20, epoch), velocity, epoch)
      .ok,
  );
  assert(!validateEarthWalk(position, [100, 0, 0], epoch).ok);
  assert(
    !validateEarthWalk(earthSurfacePoint(0, -140, 4, epoch), [0, 0, 0], epoch)
      .ok,
  );
});
test("walking holds human eye height, follows Earth rotation and caps diagonal/sprint movement", () => {
  const pose = earthAnchoredPose(anchor, WALK_EYE_HEIGHT, epoch);
  assert(
    Math.abs(
      getEarthSurfaceStatus(pose.position, [0, 0, 0], epoch).altitude -
        WALK_EYE_HEIGHT,
    ) < 2e-9,
  );
  let next = anchor;
  for (let i = 0; i < 200; i++) {
    const at = epoch + i * 50,
      here = earthAnchoredPose(next, WALK_EYE_HEIGHT, at);
    next = stepEarthWalk({
      anchor: next,
      controlVector: here.north,
      dt: 0.05,
      utcMs: at,
    }).walkAnchor;
  }
  assert(
    Math.abs(earthAnchorDistance(anchor, next, epoch) * METRES_PER_UNIT - 16) <
      0.05,
  );
  const fast = stepEarthWalk({
    anchor,
    controlVector: pose.north.map((v) => v * 100000),
    dt: 0.2,
    utcMs: epoch,
  });
  assert(
    earthAnchorDistance(anchor, fast.walkAnchor, epoch) * METRES_PER_UNIT <
      0.561,
  );
  const vertical = stepEarthWalk({
    anchor,
    controlVector: pose.up,
    dt: 0.2,
    utcMs: epoch,
  });
  assert(
    earthAnchorDistance(anchor, vertical.walkAnchor, epoch) * METRES_PER_UNIT <
      0.001,
  );
  const stationary = stepEarthWalk({ anchor, utcMs: epoch + 3600000 });
  assert.deepEqual(stationary.walkAnchor, anchor);
  assert(distance(stationary.position, pose.position) > 1000);
});
test("boarding keeps the parked location and refuses remote recall", () => {
  const start = validateEarthWalk(
    earthSurfacePoint(25, 15, 4, epoch),
    earthPointVelocity(anchor, 4, epoch),
    epoch,
  );
  assert(boardEarthShip(start.walkAnchor, start.parkedShip, epoch).ok);
  const far = earthAnchorAt(earthSurfacePoint(25.01, 15, 0, epoch), epoch);
  assert(!boardEarthShip(far, start.parkedShip, epoch).ok);
  const board = boardEarthShip(start.walkAnchor, start.parkedShip, epoch);
  assert(
    getEarthSurfaceStatus(board.position, board.velocity, epoch).altitude > 3.2,
  );
});
test("local detail tile has outward normals, human-scale precision and shared ground height", () => {
  const earth = getEarthSurfaceState(epoch),
    tile = createLocalEarthTerrain(anchor, earth.radius, 24000, 160),
    g = tile.geometry,
    p = g.attributes.position;
  assert.equal(p.count, 161 * 161);
  assert(Math.max(...[0, 1, 2].map((i) => Math.abs(p.array[i]))) < 1);
  const center = 80 * 161 + 80;
  assert(Math.hypot(p.getX(center), p.getY(center), p.getZ(center)) < 1e-7);
  const normal = new Vector3().fromBufferAttribute(g.attributes.normal, center);
  assert(normal.dot(new Vector3(...anchor)) > 0.8);
  const material = new MeshBasicMaterial(),
    mesh = new Mesh(g, material),
    up = new Vector3(...anchor);
  mesh.updateMatrixWorld();
  const ray = new Raycaster(
    up.clone().multiplyScalar(10 / METRES_PER_UNIT),
    up.clone().negate(),
  );
  const hit = ray.intersectObject(mesh)[0];
  assert(hit);
  assert(hit.point.length() * METRES_PER_UNIT < 0.05);
  for (let i = 0; i < p.count; i += 127) {
    const local = tile.frame.center.map((v, j) => v + p.array[i * 3 + j]);
    const r = Math.hypot(...local);
    assert(
      Math.abs(r - earth.radius - earthSurfaceHeight(local)) * METRES_PER_UNIT <
        0.05,
    );
  }
  g.dispose();
  material.dispose();
});
test("authoritative walking preserves identity/economy, rejects spoofed old controls and excludes ship-sized contacts", (t) => {
  const { world, p, join } = fixture(t),
    token = p.token;
  p.cargo = 7;
  p.credits = 50;
  assert.equal(
    world.requestSurface("walking", "walker", "forged", "walk", 0).status,
    401,
  );
  const land = world.requestSurface("walking", "walker", token, "walk", 0);
  assert(land.ok);
  assert.equal(p.movementMode, "walk");
  assert.equal(p.movementSequence, 1);
  assert(
    !world.input("walking", "walker", token, {
      frameIndex: 1,
      controlVector: [1, 0, 0],
      direction: [0, 0, 1],
      movementSequence: 0,
    }),
  );
  const pose = earthAnchoredPose(p.walkAnchor, WALK_EYE_HEIGHT, epoch);
  assert(
    world.input("walking", "walker", token, {
      frameIndex: 1,
      controlVector: pose.north,
      direction: pose.north,
      movementSequence: 1,
    }),
  );
  t.mock.timers.tick(50);
  world.tick();
  assert(p.walkSpeed > 0);
  assert(
    Math.abs(
      getEarthSurfaceStatus(p.position, p.velocity).altitude - WALK_EYE_HEIGHT,
    ) < 2e-9,
  );
  const state = world
    .state("walking", "walker", token)
    .state.players.find((p) => p.id === "walker");
  assert.equal(state.movementMode, "walk");
  assert(state.walkAnchor);
  assert(state.parkedShip);
  assert(distance(state.position, p.position) * METRES_PER_UNIT < 0.1);
  assert(Object.isFrozen(state.walkAnchor));
  assert.equal(
    world.requestSurface("walking", "walker", token, "board", 0).status,
    409,
  );
  assert(world.requestSurface("walking", "walker", token, "board", 1).ok);
  assert.equal(p.movementMode, "ship");
  assert.equal(p.token, token);
  assert.equal(p.cargo, 7);
  assert.equal(p.credits, 50);
  assert(!p.walkAnchor);
  assert(!p.parkedShip);
});

test("surface props are deterministic, grounded and shared with walking collision checks", async () => {
  const { earthNatureTile, earthNatureBlocked } =
    await import("../lib/earthNature.js");
  const radius = getEarthSurfaceState(epoch).radius,
    tile = earthNatureTile(anchor, radius);
  assert(tile.props.length > 0 && tile.props.length <= 200);
  assert.deepEqual(earthNatureTile([...anchor], radius), tile);
  for (const p of tile.props) {
    assert(Math.abs(Math.hypot(...p.direction) - 1) < 1e-12);
    assert(p.height > 0 && p.height < 8);
    assert(earthNatureBlocked(p.direction, radius));
  }
  const obstacle = tile.props.find((p) => p.kind === "rock"),
    pose = earthAnchoredPose(obstacle.direction, WALK_EYE_HEIGHT, epoch),
    localRight = earthLocalVector(
      pose.right,
      getEarthSurfaceState(epoch).orientation,
    );
  const separation =
      (obstacle.radius + 0.28 + 0.1) / (METRES_PER_UNIT * radius),
    start = obstacle.direction.map((v, i) => v + localRight[i] * separation),
    length = Math.hypot(...start),
    unit = start.map((v) => v / length);
  const walked = stepEarthWalk({
    anchor: unit,
    controlVector: pose.right.map((v) => -v),
    dt: 0.2,
    utcMs: epoch,
  });
  assert(walked.blocked);
  assert(
    earthAnchorDistance(unit, walked.walkAnchor, epoch) * METRES_PER_UNIT <
      0.001,
  );
});
