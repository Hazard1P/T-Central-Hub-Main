import { sweepSphere } from "./physics/collisions.js";
export const PULSE_INTERVAL_MS = 200;
export const PULSE_SPEED = 64;
export const PULSE_LIFETIME_MS = 2200;
export const PULSE_MUZZLE_OFFSET = 1.4;
// Shared by the rendered barrels, local prediction and authoritative weapons.
export const SHIP_CANNON_MUZZLES = Object.freeze([
  Object.freeze([-1.4, 0.05, PULSE_MUZZLE_OFFSET]),
  Object.freeze([1.4, 0.05, PULSE_MUZZLE_OFFSET]),
]);
const finiteVector = (value) =>
  Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

export function normalizedAim(direction) {
  if (!finiteVector(direction)) return null;
  const length = Math.hypot(...direction);
  return Number.isFinite(length) && length > 0.00001
    ? direction.map((value) => value / length)
    : null;
}

export function createPulseShot({
  origin,
  direction,
  now,
  id,
  ownerId = null,
  inheritedVelocity = [0, 0, 0],
}) {
  const aim = normalizedAim(direction);
  if (
    !finiteVector(origin) ||
    !finiteVector(inheritedVelocity) ||
    !aim ||
    !Number.isFinite(now)
  )
    return null;
  return {
    id,
    ownerId,
    origin: [...origin],
    direction: aim,
    velocity: aim.map(
      (value, axis) => value * PULSE_SPEED + inheritedVelocity[axis],
    ),
    createdAt: now,
    updatedAt: now,
    expiresAt: now + PULSE_LIFETIME_MS,
    hit: false,
  };
}

export function normalizedShipOrientation(value) {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    !value.every(Number.isFinite)
  )
    return null;
  const length = Math.hypot(...value);
  return length >= 0.9 && length <= 1.1 ? value.map((v) => v / length) : null;
}
export function orientationFromDirection(direction) {
  const aim = normalizedAim(direction);
  if (!aim) return null;
  if (aim[2] < -0.999999999) return [0, 1, 0, 0];
  const q = [-aim[1], aim[0], 0, 1 + aim[2]],
    length = Math.hypot(...q);
  return q.map((v) => v / length);
}
export function rotateShipVector(vector, q) {
  const [x, y, z, w] = q,
    [vx, vy, vz] = vector;
  const tx = 2 * (y * vz - z * vy),
    ty = 2 * (z * vx - x * vz),
    tz = 2 * (x * vy - y * vx);
  return [
    vx + w * tx + y * tz - z * ty,
    vy + w * ty + z * tx - x * tz,
    vz + w * tz + x * ty - y * tx,
  ];
}

// The server supplies position and velocity. Clients can select only one of the
// fixed barrels and a unit orientation, never an arbitrary origin or scale.
export function createShipPulse({
  position,
  direction,
  orientation,
  cannonIndex = 0,
  ...options
}) {
  const aim = normalizedAim(direction);
  const q =
    orientation === undefined
      ? orientationFromDirection(aim)
      : normalizedShipOrientation(orientation);
  if (!finiteVector(position) || !aim || !q || ![0, 1].includes(cannonIndex))
    return null;
  const offset = rotateShipVector(SHIP_CANNON_MUZZLES[cannonIndex], q);
  const origin = position.map((v, i) => v + offset[i]);
  const shot = createPulseShot({ ...options, origin, direction: aim });
  return shot ? { ...shot, cannonIndex } : null;
}

export function pulsePosition(shot, now) {
  const seconds =
    Math.max(0, Math.min(PULSE_LIFETIME_MS, now - shot.createdAt)) / 1000;
  return shot.origin.map(
    (value, axis) => value + shot.velocity[axis] * seconds,
  );
}

// Sweep a whole frame segment so fast pulses cannot skip a small rock between frames.
export function segmentSphereHit(from, to, center, radius) {
  return sweepSphere(from, to, center, radius)?.point || null;
}
