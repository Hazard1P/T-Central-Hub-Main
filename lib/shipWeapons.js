export const PULSE_INTERVAL_MS = 200;
export const PULSE_SPEED = 64;
export const PULSE_LIFETIME_MS = 2200;
const finiteVector = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

export function normalizedAim(direction) {
  if (!finiteVector(direction)) return null;
  const length = Math.hypot(...direction);
  return Number.isFinite(length) && length > .00001 ? direction.map((value) => value / length) : null;
}

export function createPulseShot({ origin, direction, now, id, ownerId = null }) {
  const aim = normalizedAim(direction);
  if (!finiteVector(origin) || !aim || !Number.isFinite(now)) return null;
  return { id, ownerId, origin: [...origin], direction: aim, velocity: aim.map((value) => value * PULSE_SPEED), createdAt: now, expiresAt: now + PULSE_LIFETIME_MS, hit: false };
}

export function pulsePosition(shot, now) {
  const seconds = Math.max(0, Math.min(PULSE_LIFETIME_MS, now - shot.createdAt)) / 1000;
  return shot.origin.map((value, axis) => value + shot.velocity[axis] * seconds);
}

// Sweep a whole frame segment so fast pulses cannot skip a small rock between frames.
export function segmentSphereHit(from, to, center, radius) {
  const delta = to.map((value, axis) => value - from[axis]);
  const offset = from.map((value, axis) => value - center[axis]);
  const a = delta.reduce((sum, value) => sum + value * value, 0);
  if (a < 1e-12) return null;
  const b = 2 * delta.reduce((sum, value, axis) => sum + value * offset[axis], 0);
  const c = offset.reduce((sum, value) => sum + value * value, 0) - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? from.map((value, axis) => value + delta[axis] * t) : null;
}
