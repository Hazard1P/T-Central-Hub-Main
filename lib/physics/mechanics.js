// Pure, renderer-independent mechanics. Distances are world units, time seconds.
import { AU_KM } from "../solarSystem.js";
import { SOLAR_UNITS_PER_AU } from "../universeSpace.js";
export const KM_PER_UNIT = AU_KM / SOLAR_UNITS_PER_AU;
export const LIGHT_SPEED = 299792.458 / KM_PER_UNIT;
export const GRAVITATIONAL_CONSTANT_SI = 6.6743e-11;
export const GAME_GRAVITY_CONSTANT = 0.22;
export const SHIP_CONTACT_RADIUS = 3.2;
export const PHYSICS_VERSION = "universe-physics-7";
export const solarMu = (km3PerSecond2) => km3PerSecond2 / KM_PER_UNIT ** 3;
export const muFromKilograms = (massKg) =>
  (GRAVITATIONAL_CONSTANT_SI * massKg) / (KM_PER_UNIT * 1000) ** 3;
export const schwarzschildRadius = (mu) => (2 * mu) / LIGHT_SPEED ** 2;
export const vector = (v, fallback = [0, 0, 0], limit = Infinity) =>
  Array.isArray(v) && v.length >= 3
    ? [0, 1, 2].map((i) =>
        Number.isFinite(Number(v[i]))
          ? Math.max(-limit, Math.min(limit, Number(v[i])))
          : fallback[i],
      )
    : [...fallback];
export const length = (v) => Math.hypot(v[0], v[1], v[2]);
export const distance = (a, b) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export function rk4Step(position, velocity, seconds, acceleration) {
  const add = (a, b, k) => a.map((v, i) => v + b[i] * k);
  const a1 = acceleration(position, velocity, 0),
    p2 = add(position, velocity, seconds / 2),
    v2 = add(velocity, a1, seconds / 2);
  const a2 = acceleration(p2, v2, seconds / 2),
    p3 = add(position, v2, seconds / 2),
    v3 = add(velocity, a2, seconds / 2);
  const a3 = acceleration(p3, v3, seconds / 2),
    p4 = add(position, v3, seconds),
    v4 = add(velocity, a3, seconds);
  const a4 = acceleration(p4, v4, seconds);
  return {
    position: position.map(
      (v, i) =>
        v + (seconds / 6) * (velocity[i] + 2 * v2[i] + 2 * v3[i] + v4[i]),
    ),
    velocity: velocity.map(
      (v, i) => v + (seconds / 6) * (a1[i] + 2 * a2[i] + 2 * a3[i] + a4[i]),
    ),
  };
}

export function sampleField(
  position,
  sources = [],
  { diagnostics = false, velocity = [0, 0, 0] } = {},
) {
  let x = 0,
    y = 0,
    z = 0,
    potential = 0,
    physicalPotential = 0;
  const details = [];
  for (const source of sources) {
    const dx = source.position[0] - position[0],
      dy = source.position[1] - position[1],
      dz = source.position[2] - position[2];
    const r = Math.hypot(dx, dy, dz),
      mu = Math.max(
        0,
        source.mu ?? GAME_GRAVITY_CONSTANT * (Number(source.mass) || 0),
      );
    const softened = Math.max(
      r,
      source.softening ?? (source.eventHorizonRadius * 0.8 || 0.4),
    );
    const denominator = softened ** 2 + (source.physical ? 0 : 0.3);
    const strength = mu / Math.max(denominator, 1e-12),
      scale = r > 1e-12 ? strength / r : 0;
    x += dx * scale;
    y += dy * scale;
    z += dz * scale;
    potential -= mu / Math.max(softened, 1e-9);
    if (source.physical) physicalPotential -= mu / Math.max(softened, 1e-9);
    if (diagnostics)
      details.push({
        key: source.key,
        kind: source.kind,
        distance: r,
        strength,
        tidal: (2 * mu) / Math.max(softened, 1e-9) ** 3,
        escapeVelocity: Math.sqrt((2 * mu) / Math.max(softened, 1e-9)),
        source,
      });
  }
  if (!diagnostics) return [x, y, z];
  details.sort((a, b) => a.distance - b.distance);
  const beta = length(velocity) / LIGHT_SPEED;
  const curvature = (2 * physicalPotential) / LIGHT_SPEED ** 2;
  const supported = beta < 1 && Math.abs(curvature) < 0.01;
  const properTimeRate = supported
    ? Math.sqrt(1 - beta * beta) * Math.sqrt(1 + curvature)
    : null;
  return {
    acceleration: [x, y, z],
    potential,
    physicalPotential,
    diagnostics: details,
    nearest: details[0] || null,
    relativity: {
      properTimeRate,
      beta,
      model: supported
        ? "weak-field Schwarzschild + special relativity"
        : "outside weak-field/subluminal model",
    },
  };
}
export function horizonMetrics(position, sources = []) {
  let nearest = null;
  for (const source of sources) {
    if (source.kind !== "blackhole") continue;
    const r = distance(position, source.position),
      radius = Math.max(0, source.eventHorizonRadius || 0),
      radialDistance = Math.max(0, r - radius);
    const lensing = Math.exp(
      -0.5 * (radialDistance / Math.max(radius * 3.2, 1) / 0.8) ** 2,
    );
    if (!nearest || r < nearest.distance)
      nearest = {
        key: source.key,
        kind: source.kind,
        distance: r,
        radialDistance,
        eventHorizonRadius: radius,
        lensing,
        insideHorizon: r <= radius,
        model: "fictional horizon boundary",
      };
  }
  return nearest;
}
