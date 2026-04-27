const HASH_SEED = 2166136261;

function hashString(input = '') {
  let hash = HASH_SEED;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export const SIM_RUNTIME_STATUS = {
  ONLINE: 'online',
  DEGRADED: 'degraded',
};

export function computeSimulationStateHash(snapshot = {}) {
  const payload = JSON.stringify({
    seed: snapshot.simulationSeed || 'tcentral-main',
    frameIndex: Number.isFinite(snapshot.frameIndex) ? snapshot.frameIndex : 0,
    dt: Number.isFinite(snapshot.dt) ? Number(snapshot.dt.toFixed(6)) : 0,
    position: Array.isArray(snapshot.position) ? snapshot.position.map((value) => Number(Number(value || 0).toFixed(4))) : [0, 0, 0],
    velocity: Array.isArray(snapshot.velocity) ? snapshot.velocity.map((value) => Number(Number(value || 0).toFixed(4))) : [0, 0, 0],
    controlVector: Array.isArray(snapshot.controlVector) ? snapshot.controlVector.map((value) => Number(Number(value || 0).toFixed(4))) : [0, 0, 0],
    runtimeStatus: snapshot.runtimeStatus || SIM_RUNTIME_STATUS.ONLINE,
  });
  return hashString(payload);
}

export function createContinuityHeartbeat({ snapshot = {}, runtimeStatus = SIM_RUNTIME_STATUS.ONLINE, degradedReason = null } = {}) {
  const stateHash = computeSimulationStateHash({ ...snapshot, runtimeStatus });
  return {
    stateHash,
    runtimeStatus,
    degradedReason: degradedReason || null,
    continuityHealthSnapshot: {
      stateHash,
      runtimeStatus,
      healthy: runtimeStatus === SIM_RUNTIME_STATUS.ONLINE,
      degraded: runtimeStatus !== SIM_RUNTIME_STATUS.ONLINE,
      tick: Date.now(),
    },
  };
}

