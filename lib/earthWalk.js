import { KM_PER_UNIT, SHIP_CONTACT_RADIUS } from "./physics/mechanics.js";
import { earthNatureBlocked } from "./earthNature.js";
import {
  getEarthSurfaceState,
  getEarthSurfaceStatus,
  earthSurfaceHeight,
  earthLandCoverage,
  earthWorldVector,
  earthLocalVector,
} from "./earthSurface.js";
export const METRES_PER_UNIT = KM_PER_UNIT * 1000;
export const WALK_EYE_HEIGHT = 1.7 / METRES_PER_UNIT;
export const WALK_SPEED = 1.6 / METRES_PER_UNIT;
export const WALK_BOARD_RANGE = 30 / METRES_PER_UNIT;
export const PARKED_SHIP_SCALE = 0.00015;
export const PARKED_SHIP_HEIGHT = 3 / METRES_PER_UNIT;
export const WALK_APPROACH_ALTITUDE = 8;
export const WALK_APPROACH_SPEED = 8;
export const normal = (v) => {
  const r = Math.hypot(...v) || 1;
  return v.map((x) => x / r);
};
const add = (a, b) => a.map((v, i) => v + b[i]);
const scale = (a, s) => a.map((v) => v * s);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
export function earthAnchorAt(position, utcMs = Date.now()) {
  const earth = getEarthSurfaceState(utcMs);
  return normal(
    earthLocalVector(
      normal(position.map((v, i) => v - earth.position[i])),
      earth.orientation,
    ),
  );
}
export function earthAnchoredPose(
  anchor,
  height = WALK_EYE_HEIGHT,
  utcMs = Date.now(),
) {
  const earth = getEarthSurfaceState(utcMs),
    local = normal(anchor),
    up = earthWorldVector(local, earth.orientation);
  const position = add(
    earth.position,
    scale(up, earth.radius + earthSurfaceHeight(local) + height),
  );
  return {
    position,
    ...getEarthSurfaceStatus(position, [0, 0, 0], utcMs),
    anchor: local,
  };
}
export function earthAnchorDistance(a, b, utcMs = Date.now()) {
  // atan2 remains accurate for metre-scale distances on a million-unit orbit.
  const cross = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  return (
    Math.atan2(Math.hypot(...cross), dot(a, b)) *
    getEarthSurfaceState(utcMs).radius
  );
}
export function earthPointVelocity(anchor, height, utcMs = Date.now()) {
  const a = earthAnchoredPose(anchor, height, utcMs - 20).position,
    b = earthAnchoredPose(anchor, height, utcMs).position;
  return b.map((v, i) => (v - a[i]) * 50);
}
export function validateEarthWalk(
  position,
  velocity = [0, 0, 0],
  utcMs = Date.now(),
) {
  const status = getEarthSurfaceStatus(position, velocity, utcMs),
    anchor = earthAnchorAt(position, utcMs);
  if (status.altitude > WALK_APPROACH_ALTITUDE || status.altitude < -0.5)
    return {
      ok: false,
      status: 409,
      error: "Approach Earth within 8 u of the surface to land.",
    };
  const groundVelocity = earthPointVelocity(anchor, 0, utcMs);
  if (
    Math.hypot(...velocity.map((v, i) => v - groundVelocity[i])) >
    WALK_APPROACH_SPEED
  )
    return {
      ok: false,
      status: 409,
      error: "Brake below 8 u/s relative to Earth before landing.",
    };
  if (earthLandCoverage(anchor) < 0.65)
    return {
      ok: false,
      status: 409,
      error: "Choose dry land before leaving the ship.",
    };
  // Place the explorer beside the hull, never inside it.
  const earth = getEarthSurfaceState(utcMs),
    right = earthLocalVector(status.right, earth.orientation);
  const candidates = [1, -1, 0].map((side) =>
    normal(
      add(anchor, scale(right, (side * 18) / METRES_PER_UNIT / earth.radius)),
    ),
  );
  const walkAnchor = candidates.find(
    (point) =>
      earthLandCoverage(point) >= 0.65 &&
      !earthNatureBlocked(point, earth.radius),
  );
  if (!walkAnchor)
    return {
      ok: false,
      status: 409,
      error: "Find a wider area of dry land before landing.",
    };
  return {
    ok: true,
    walkAnchor,
    parkedShip: {
      anchor,
      heading: earthLocalVector(status.north, earth.orientation),
    },
  };
}
export function stepEarthWalk({
  anchor,
  controlVector = [0, 0, 0],
  dt = 0,
  utcMs = Date.now(),
  parkedShip = null,
}) {
  const earth = getEarthSurfaceState(utcMs),
    unit = normal(anchor);
  const local = earthLocalVector(controlVector, earth.orientation),
    vertical = dot(local, unit);
  let tangent = local.map((v, i) => v - unit[i] * vertical),
    magnitude = Math.hypot(...tangent);
  if (magnitude > 1.75) tangent = scale(tangent, 1.75 / magnitude);
  const seconds = Math.max(0, Math.min(0.2, Number(dt) || 0));
  let next = normal(
    add(unit, scale(tangent, (WALK_SPEED * seconds) / earth.radius)),
  );
  const blocked =
    earthLandCoverage(next) < 0.6 ||
    earthNatureBlocked(next, earth.radius) ||
    Boolean(
      parkedShip?.anchor &&
      earthAnchorDistance(next, parkedShip.anchor, utcMs) * METRES_PER_UNIT < 8,
    );
  if (blocked) next = unit;
  const pose = earthAnchoredPose(next, WALK_EYE_HEIGHT, utcMs);
  return {
    ...pose,
    walkAnchor: next,
    velocity: add(
      earthPointVelocity(next, WALK_EYE_HEIGHT, utcMs),
      scale(
        earthWorldVector(tangent, earth.orientation),
        blocked ? 0 : WALK_SPEED,
      ),
    ),
    walkSpeed: blocked ? 0 : Math.min(1.75, magnitude) * WALK_SPEED,
    blocked,
  };
}
export function boardEarthShip(walkAnchor, parkedShip, utcMs = Date.now()) {
  if (
    !parkedShip?.anchor ||
    earthAnchorDistance(walkAnchor, parkedShip.anchor, utcMs) > WALK_BOARD_RANGE
  )
    return {
      ok: false,
      status: 409,
      error: "Walk within 30 m of your ship to board.",
    };
  const pose = earthAnchoredPose(
    parkedShip.anchor,
    SHIP_CONTACT_RADIUS + 0.8,
    utcMs,
  );
  return {
    ok: true,
    position: pose.position,
    velocity: add(
      earthPointVelocity(parkedShip.anchor, SHIP_CONTACT_RADIUS + 0.8, utcMs),
      scale(pose.up, 0.5),
    ),
    direction: pose.north,
    orientation: pose.orientation,
  };
}
