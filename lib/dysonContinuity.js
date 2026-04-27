import continuityManifest from '@/data/dyson-continuity.manifest.json';

export const DYSON_CONTINUITY_SCHEMA_VERSION = 4;
const DYSON_RING_INTEGRITY_INTERVAL_MS = 1000;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeSphereState(input = {}) {
  return {
    stateVersion: Number.isFinite(Number(input.stateVersion)) ? Number(input.stateVersion) : 0,
    lastMilestone: typeof input.lastMilestone === 'string' ? input.lastMilestone : 'uninitialized',
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : null,
  };
}

const dysonRingIntegrityRuntime = globalThis.__dysonRingIntegrityRuntime || {
  latestRings: null,
  latestValidation: {
    ok: false,
    missingContracts: ['ring1', 'ring2', 'ring3'],
    checkedAt: null,
  },
  timerId: null,
};

if (!globalThis.__dysonRingIntegrityRuntime) {
  globalThis.__dysonRingIntegrityRuntime = dysonRingIntegrityRuntime;
}

export function validateDysonRingContracts(rings = {}) {
  const ring1Valid = Boolean(rings?.ring1?.dispersalPayload) && Boolean(rings?.ring1?.targetMatrix);
  const ring2Valid = Boolean(rings?.ring2?.externalIngressEgress);
  const ring3Valid = Boolean(rings?.ring3?.entropyRegen);
  const missingContracts = [];
  if (!ring1Valid) missingContracts.push('ring1');
  if (!ring2Valid) missingContracts.push('ring2');
  if (!ring3Valid) missingContracts.push('ring3');

  return {
    ok: missingContracts.length === 0,
    missingContracts,
    checkedAt: new Date().toISOString(),
  };
}

function runDysonRingIntegrityTick() {
  const validation = validateDysonRingContracts(dysonRingIntegrityRuntime.latestRings || {});
  dysonRingIntegrityRuntime.latestValidation = validation;
}

export function upsertDysonRingContinuitySnapshot(rings = {}) {
  dysonRingIntegrityRuntime.latestRings = rings;
  runDysonRingIntegrityTick();
  return dysonRingIntegrityRuntime.latestValidation;
}

export function startDysonRingIntegrityService() {
  if (dysonRingIntegrityRuntime.timerId) return dysonRingIntegrityRuntime.timerId;
  dysonRingIntegrityRuntime.timerId = setInterval(runDysonRingIntegrityTick, DYSON_RING_INTEGRITY_INTERVAL_MS);
  if (typeof dysonRingIntegrityRuntime.timerId?.unref === 'function') {
    dysonRingIntegrityRuntime.timerId.unref();
  }
  return dysonRingIntegrityRuntime.timerId;
}

export function getDysonRingIntegrityStatus() {
  return {
    intervalMs: DYSON_RING_INTEGRITY_INTERVAL_MS,
    ...(dysonRingIntegrityRuntime.latestValidation || validateDysonRingContracts({})),
  };
}

export function createDefaultContinuityState({ release = '0.0.0', now = new Date().toISOString() } = {}) {
  const spheres = {};
  for (const id of continuityManifest.canonicalSphereIds) {
    const stateKey = continuityManifest.spheres?.[id]?.stateKey;
    if (!stateKey) continue;
    spheres[stateKey] = {
      stateVersion: 0,
      lastMilestone: 'initialized',
      updatedAt: now,
    };
  }

  return {
    schemaVersion: DYSON_CONTINUITY_SCHEMA_VERSION,
    release,
    spheres,
  };
}

export function migrateDysonContinuityState(raw = {}, { targetRelease = '0.0.0', now = new Date().toISOString() } = {}) {
  const state = asObject(raw);
  const sourceSchema = Number.isFinite(Number(state.schemaVersion)) ? Number(state.schemaVersion) : 0;
  const sourceSpheres = asObject(state.spheres);
  const next = createDefaultContinuityState({ release: targetRelease, now });

  for (const canonicalId of continuityManifest.canonicalSphereIds) {
    const stateKey = continuityManifest.spheres?.[canonicalId]?.stateKey;
    if (!stateKey) continue;
    const migrated = normalizeSphereState(sourceSpheres[stateKey]);
    next.spheres[stateKey] = {
      ...next.spheres[stateKey],
      ...migrated,
      updatedAt: now,
    };
  }

  return {
    ...next,
    release: targetRelease,
    migratedFromSchema: sourceSchema,
    rollbackSafe: sourceSchema <= DYSON_CONTINUITY_SCHEMA_VERSION,
  };
}
