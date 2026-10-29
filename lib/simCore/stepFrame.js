import { WORLD_LIMIT, MAX_FLIGHT_SPEED } from "../universeSpace.js";
import { getFlightEnvironment } from "../universeFlight.js";
import { createPhysicsFrame } from "../physics/world.js";
import {
  rk4Step,
  sampleField,
  horizonMetrics,
  vector,
  distance,
  PHYSICS_VERSION,
  SHIP_CONTACT_RADIUS,
} from "../physics/mechanics.js";
import { resolveStaticContacts } from "../physics/collisions.js";
import { constrainEarthSurfaceFlight } from "../earthSurface.js";
import { COSMIC_GRAVITY_SOURCES } from "../cosmicLayout.js";
import { FLIGHT_TUNING, governedThrust } from "../flightTuning.js";

const DEFAULT_BOUNDS = {
  x: [-WORLD_LIMIT, WORLD_LIMIT],
  y: [-WORLD_LIMIT, WORLD_LIMIT],
  z: [-WORLD_LIMIT, WORLD_LIMIT],
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampNumber(value, fallback = 0, min = -Infinity, max = Infinity) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return clamp(num, min, max);
}

function sanitizeVec3(input, fallback = [0, 0, 0], min = -1e6, max = 1e6) {
  if (!Array.isArray(input) || input.length < 3) return fallback.slice(0, 3);
  return [
    clampNumber(input[0], fallback[0], min, max),
    clampNumber(input[1], fallback[1], min, max),
    clampNumber(input[2], fallback[2], min, max),
  ];
}

function vecAdd(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function vecScale(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}
function vecLen(v) {
  return Math.hypot(...v);
}

const BOOST_SAFE_CONTROL_MAGNITUDE = FLIGHT_TUNING.maxControl;

export const SIM_TUNING_PROFILES = {
  singleplayer: {
    gravityConstant: 0.22,
    thrust: FLIGHT_TUNING.thrust,
    drag: 0,
    dragBySpeed: 0,
    maxSpeed: FLIGHT_TUNING.localSpeed,
    maxControlMagnitude: BOOST_SAFE_CONTROL_MAGNITUDE,
    worldBounds: DEFAULT_BOUNDS,
  },
  multiplayer: {
    gravityConstant: 0.22,
    thrust: FLIGHT_TUNING.thrust,
    drag: 0,
    dragBySpeed: 0,
    maxSpeed: FLIGHT_TUNING.localSpeed,
    maxControlMagnitude: BOOST_SAFE_CONTROL_MAGNITUDE,
    worldBounds: DEFAULT_BOUNDS,
  },
};

function mulberry32(seed) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stringToSeed(source = "tcentral-main") {
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildGravitySourcesFromSeed(seedSource = "tcentral-main") {
  const seed = stringToSeed(String(seedSource || "tcentral-main"));
  const rand = mulberry32(seed);
  return COSMIC_GRAVITY_SOURCES.map((item) => ({
    ...item,
    mass: Number((item.mass * (0.95 + rand() * 0.1)).toFixed(4)),
    position: [...item.position],
    eventHorizonRadius: item.eventHorizonRadius,
  }));
}

function computeAcceleration(
  position,
  velocity,
  controlVector,
  sources,
  profile,
) {
  const maxControlMagnitude = clampNumber(profile.maxControlMagnitude, 1, 1, 3);
  const control = sanitizeVec3(
    controlVector,
    [0, 0, 0],
    -maxControlMagnitude,
    maxControlMagnitude,
  );
  const controlLen = vecLen(control);
  const cappedControl =
    controlLen > maxControlMagnitude
      ? vecScale(control, maxControlMagnitude / controlLen)
      : control;
  const thrust = governedThrust(
    velocity,
    vecScale(cappedControl, profile.thrust),
    profile.maxSpeed,
    profile.thrust,
  );
  const gravity = sampleField(position, sources);
  const drag = vecScale(
    velocity,
    -(profile.drag * (1 + vecLen(velocity) * profile.dragBySpeed)),
  );
  return vecAdd(vecAdd(gravity, thrust), drag);
}

// All flight paths use this renderer-independent engine. The authoritative
// service supplies its own epoch/prepared frame; clients cannot set server time.
export function stepFrame({
  position,
  velocity,
  controlVector,
  dt,
  worldSeed = "tcentral-main",
  gravitySources,
  profile = "multiplayer",
  utcMs = Date.now(),
  physicsFrame,
  extraColliders = [],
  diagnostics = true,
} = {}) {
  const baseTuning =
    SIM_TUNING_PROFILES[profile] || SIM_TUNING_PROFILES.multiplayer;
  let currentPos = vector(position, [0, 0, 18], WORLD_LIMIT);
  let currentVel = vector(velocity, [0, 0, 0], MAX_FLIGHT_SPEED);
  const resolvedSources =
    Array.isArray(gravitySources) && gravitySources.length
      ? gravitySources
      : buildGravitySourcesFromSeed(worldSeed);
  const frame =
    physicsFrame ||
    createPhysicsFrame({
      utcMs,
      gravitySources: resolvedSources,
      extraColliders,
    });
  const stepDt = Number.isFinite(dt) ? Math.max(0, Math.min(0.2, dt)) : 1 / 60;
  const count = Math.max(1, Math.ceil(stepDt / (1 / 60))),
    seconds = stepDt / count;
  const contacts = [];
  for (let index = 0; index < count; index++) {
    const environment = getFlightEnvironment(
      currentPos,
      frame.utcMs,
      [],
      frame.obstacles,
    );
    const tuning = {
      ...baseTuning,
      thrust: baseTuning.thrust * environment.scale,
      maxSpeed: environment.speedLimit,
    };
    const next = rk4Step(currentPos, currentVel, seconds, (p, v) =>
      computeAcceleration(p, v, controlVector, frame.sources, tuning),
    );
    // Regional limits use bounded braking, rather than instantly discarding
    // velocity on entering an approach zone. Only the global safety cap clamps;
    // swept hull contacts continue to prevent surface tunneling.
    const displacement = next.position.map((v, i) => v - currentPos[i]),
      travel = Math.hypot(...displacement);
    if (seconds > 0 && travel > MAX_FLIGHT_SPEED * seconds)
      next.position = currentPos.map(
        (v, i) => v + (displacement[i] * MAX_FLIGHT_SPEED * seconds) / travel,
      );
    const speed = vecLen(next.velocity);
    if (speed > MAX_FLIGHT_SPEED)
      next.velocity = vecScale(next.velocity, MAX_FLIGHT_SPEED / speed);
    const safe = resolveStaticContacts({
      from: currentPos,
      position: next.position,
      velocity: next.velocity,
      bodies: frame.bodies,
      radius: SHIP_CONTACT_RADIUS,
    });
    contacts.push(...safe.contacts);
    const surface = constrainEarthSurfaceFlight(
      safe.position,
      safe.velocity,
      frame.utcMs,
      currentPos,
    );
    contacts.push(...surface.contacts);
    currentPos = surface.position;
    currentVel = surface.velocity;
    for (let axis = 0; axis < 3; axis++) {
      const bounded = clamp(currentPos[axis], -WORLD_LIMIT, WORLD_LIMIT);
      if (
        bounded !== currentPos[axis] &&
        currentVel[axis] * currentPos[axis] > 0
      )
        currentVel[axis] = 0;
      currentPos[axis] = bounded;
    }
  }
  const field = diagnostics
    ? sampleField(currentPos, frame.sources, {
        diagnostics: true,
        velocity: currentVel,
      })
    : null;
  return {
    position: currentPos,
    velocity: currentVel,
    gravity: field?.acceleration || sampleField(currentPos, frame.sources),
    sources: frame.sources,
    nearest: field?.nearest || null,
    horizon: diagnostics ? horizonMetrics(currentPos, frame.sources) : null,
    physics: field
      ? {
          version: PHYSICS_VERSION,
          utcMs: frame.utcMs,
          potential: field.potential,
          relativity: field.relativity,
          contacts,
          flightAssist: true,
          travel: getFlightEnvironment(
            currentPos,
            frame.utcMs,
            [],
            frame.obstacles,
          ),
        }
      : null,
  };
}

export function computePositionError(a = [0, 0, 0], b = [0, 0, 0]) {
  return distance(
    vector(a, [0, 0, 0], WORLD_LIMIT),
    vector(b, [0, 0, 0], WORLD_LIMIT),
  );
}
