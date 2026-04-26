import continuityManifest from '@/data/dyson-continuity.manifest.json';

export const DYSON_CONTINUITY_SCHEMA_VERSION = 4;

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
