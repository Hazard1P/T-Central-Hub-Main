const DEFAULT_BOUNDS = {
  x: [-160, 160],
  y: [-120, 120],
  z: [-160, 160],
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

function vecAdd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function vecScale(v, s) { return [v[0] * s, v[1] * s, v[2] * s]; }
function vecSub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function vecLen(v) { return Math.sqrt((v[0] ** 2) + (v[1] ** 2) + (v[2] ** 2)); }
function vecNormalize(v) {
  const len = vecLen(v);
  if (len <= 1e-9) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

export const SIM_TUNING_PROFILES = {
  singleplayer: {
    gravityConstant: 18.5,
    thrust: 9.2,
    drag: 0.06,
    dragBySpeed: 0.04,
    maxSpeed: 20,
    worldBounds: DEFAULT_BOUNDS,
  },
  multiplayer: {
    gravityConstant: 18.5,
    thrust: 8.8,
    drag: 0.07,
    dragBySpeed: 0.04,
    maxSpeed: 19,
    worldBounds: DEFAULT_BOUNDS,
  },
};

function mulberry32(seed) {
  let t = seed + 0x6D2B79F5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stringToSeed(source = 'tcentral-main') {
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildGravitySourcesFromSeed(seedSource = 'tcentral-main') {
  const seed = stringToSeed(String(seedSource || 'tcentral-main'));
  const rand = mulberry32(seed);
  const base = [
    { key: 'deep_blackhole', kind: 'blackhole', mass: 440, position: [0, 0, -6], influenceRadius: 26 },
    { key: 'solar_system', kind: 'solar', mass: 190, position: [8, -2, 10], influenceRadius: 20 },
    { key: 'dyson_anchor', kind: 'dyson', mass: 125, position: [-10, 1.5, 6], influenceRadius: 16 },
  ];

  return base.map((item, index) => {
    const jitter = (rand() - 0.5) * 0.7;
    const scale = 0.95 + (rand() * 0.1);
    return {
      ...item,
      mass: Number((item.mass * scale).toFixed(4)),
      position: [
        Number((item.position[0] + jitter * (index + 1)).toFixed(4)),
        Number((item.position[1] - jitter * 0.6).toFixed(4)),
        Number((item.position[2] + jitter * 0.4).toFixed(4)),
      ],
      eventHorizonRadius: item.kind === 'blackhole' ? 1.2 : 0.72,
    };
  });
}

function gravityAt(position, sources, profile) {
  return sources.reduce((acc, source) => {
    const delta = vecSub(source.position || [0, 0, 0], position);
    const distance = Math.max(vecLen(delta), 0.4);
    const dir = vecNormalize(delta);
    const strength = (profile.gravityConstant * clampNumber(source.mass, 0, 0, 1e6)) / ((distance + 0.3) ** 2);
    const g = vecScale(dir, strength);
    return vecAdd(acc, g);
  }, [0, 0, 0]);
}

function computeAcceleration(position, velocity, controlVector, sources, profile) {
  const control = sanitizeVec3(controlVector, [0, 0, 0], -1.5, 1.5);
  const controlLen = vecLen(control);
  const normalizedControl = controlLen > 1 ? vecScale(control, 1 / controlLen) : control;
  const thrust = vecScale(normalizedControl, profile.thrust);
  const gravity = gravityAt(position, sources, profile);
  const drag = vecScale(velocity, -(profile.drag * (1 + (vecLen(velocity) * profile.dragBySpeed))));
  return vecAdd(vecAdd(gravity, thrust), drag);
}

export function stepFrame({
  position,
  velocity,
  controlVector,
  dt,
  worldSeed = 'tcentral-main',
  gravitySources,
  profile = 'multiplayer',
} = {}) {
  const tuning = SIM_TUNING_PROFILES[profile] || SIM_TUNING_PROFILES.multiplayer;
  const currentPos = sanitizeVec3(position, [0, 0, 18], -160, 160);
  const currentVel = sanitizeVec3(velocity, [0, 0, 0], -50, 50);
  const stepDt = clampNumber(dt, 1 / 30, 1 / 120, 0.2);
  const resolvedSources = Array.isArray(gravitySources) && gravitySources.length
    ? gravitySources.map((source) => ({ ...source, position: sanitizeVec3(source.position, [0, 0, 0], -500, 500) }))
    : buildGravitySourcesFromSeed(worldSeed);

  const a1 = computeAcceleration(currentPos, currentVel, controlVector, resolvedSources, tuning);
  const k1v = vecScale(a1, stepDt);
  const k1p = vecScale(currentVel, stepDt);

  const v2 = vecAdd(currentVel, vecScale(k1v, 0.5));
  const p2 = vecAdd(currentPos, vecScale(k1p, 0.5));
  const a2 = computeAcceleration(p2, v2, controlVector, resolvedSources, tuning);
  const k2v = vecScale(a2, stepDt);
  const k2p = vecScale(v2, stepDt);

  const v3 = vecAdd(currentVel, vecScale(k2v, 0.5));
  const p3 = vecAdd(currentPos, vecScale(k2p, 0.5));
  const a3 = computeAcceleration(p3, v3, controlVector, resolvedSources, tuning);
  const k3v = vecScale(a3, stepDt);
  const k3p = vecScale(v3, stepDt);

  const v4 = vecAdd(currentVel, k3v);
  const p4 = vecAdd(currentPos, k3p);
  const a4 = computeAcceleration(p4, v4, controlVector, resolvedSources, tuning);
  const k4v = vecScale(a4, stepDt);
  const k4p = vecScale(v4, stepDt);

  let nextVelocity = vecAdd(currentVel, vecScale(vecAdd(vecAdd(k1v, vecScale(vecAdd(k2v, k3v), 2)), k4v), 1 / 6));
  const speed = vecLen(nextVelocity);
  if (speed > tuning.maxSpeed) nextVelocity = vecScale(nextVelocity, tuning.maxSpeed / speed);

  let nextPosition = vecAdd(currentPos, vecScale(vecAdd(vecAdd(k1p, vecScale(vecAdd(k2p, k3p), 2)), k4p), 1 / 6));
  const bounds = tuning.worldBounds || DEFAULT_BOUNDS;
  nextPosition = [
    clamp(nextPosition[0], bounds.x[0], bounds.x[1]),
    clamp(nextPosition[1], bounds.y[0], bounds.y[1]),
    clamp(nextPosition[2], bounds.z[0], bounds.z[1]),
  ];

  return {
    position: nextPosition.map((v) => Number(v.toFixed(4))),
    velocity: nextVelocity.map((v) => Number(v.toFixed(4))),
    gravity: gravityAt(nextPosition, resolvedSources, tuning).map((v) => Number(v.toFixed(4))),
    sources: resolvedSources,
  };
}

export function computePositionError(a = [0, 0, 0], b = [0, 0, 0]) {
  const pa = sanitizeVec3(a, [0, 0, 0]);
  const pb = sanitizeVec3(b, [0, 0, 0]);
  return vecLen(vecSub(pa, pb));
}
