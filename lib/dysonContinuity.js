import continuityManifest from '@/data/dyson-continuity.manifest.json';

export const DYSON_CONTINUITY_SCHEMA_VERSION = 5;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeState(input = {}) {
  return {
    stateVersion: Number.isFinite(Number(input.stateVersion)) ? Number(input.stateVersion) : 0,
    lastMilestone: typeof input.lastMilestone === 'string' ? input.lastMilestone : 'uninitialized',
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : null,
  };
}

function collectStateKeys() {
  const sphereKeys = (continuityManifest.canonicalSphereIds || [])
    .map((id) => continuityManifest?.spheres?.[id]?.stateKey)
    .filter(Boolean);

  const blackholeKeys = (continuityManifest.canonicalBlackholeServerIds || [])
    .map((id) => continuityManifest?.blackholeServers?.[id]?.stateKey)
    .filter(Boolean);

  return [...sphereKeys, ...blackholeKeys];
}

export function createDefaultContinuityState({ release = '0.0.0', now = new Date().toISOString() } = {}) {
  const states = {};

  for (const stateKey of collectStateKeys()) {
    states[stateKey] = {
      stateVersion: 0,
      lastMilestone: 'initialized',
      updatedAt: now,
    };
  }

  return {
    schemaVersion: DYSON_CONTINUITY_SCHEMA_VERSION,
    release,
    states,
  };
}

export function migrateDysonContinuityState(raw = {}, { targetRelease = '0.0.0', now = new Date().toISOString() } = {}) {
  const state = asObject(raw);
  const sourceSchema = Number.isFinite(Number(state.schemaVersion)) ? Number(state.schemaVersion) : 0;
  const sourceStates = asObject(state.states);
  const sourceSpheres = asObject(state.spheres);

  const next = createDefaultContinuityState({ release: targetRelease, now });

  for (const stateKey of Object.keys(next.states)) {
    const migrated = normalizeState(sourceStates[stateKey] || sourceSpheres[stateKey]);
    next.states[stateKey] = {
      ...next.states[stateKey],
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
