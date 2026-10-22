import { sweepSphere } from "./physics/collisions.js";
export const PULSE_INTERVAL_MS = 200;
export const PULSE_SPEED = 64;
export const PULSE_LIFETIME_MS = 2200;
export const PULSE_MUZZLE_OFFSET = 4;
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
    expiresAt: now + PULSE_LIFETIME_MS,
    hit: false,
  };
}

// Pilot position is trusted by the server; origin/velocity claims from clients
// never enter its cannon simulation. Prediction uses this same muzzle geometry.
export function createShipPulse({ position, direction, ...options }) {
  const aim = normalizedAim(direction);
  if (!finiteVector(position) || !aim) return null;
  const origin = position.map((v, i) => v + aim[i] * PULSE_MUZZLE_OFFSET);
  return createPulseShot({ ...options, origin, direction: aim });
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
