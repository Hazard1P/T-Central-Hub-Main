function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hashString(input = '') {
  let hash = 2166136261;
  const text = String(input);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function toInt(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return Math.floor(clamp(Number(value) || 0, min, max));
}

export function createBlackholeIntelligenceState({ node, epochAnchor, engineTypes = [] } = {}) {
  const anchor = epochAnchor || {};
  const types = Array.isArray(engineTypes) && engineTypes.length
    ? engineTypes
    : ['warp', 'impulse', 'quantum', 'gravitic', 'relay'];
  const seed = `${node?.key || 'standalone_blackhole'}:${anchor?.unixEpochSegment || 0}:${anchor?.dysonAlignment || 0}`;
  const base = hashString(seed);

  const spinIntegerDynamics = types.map((engineType, index) => {
    const hashed = hashString(`${seed}:${engineType}:${index}`);
    return {
      engineType,
      spinInteger: toInt((hashed % 97) + 3, 1, 1000),
      encryptedSpinToken: (hashed ^ base).toString(36),
      continuityPulse: Number((0.35 + ((hashed % 51) / 100)).toFixed(4)),
    };
  });

  return {
    standalone: true,
    anchorage: 'relative-server-anchor',
    dataStorage: 'blackhole-core-ledger',
    entropicStorage: 'entropy-vault',
    starNodeMesh: 'star-node-relativity-grid',
    dysonIntegration: 'tri-ring-handoff',
    universeFabricRelativity: Number((0.5 + (anchor?.siderealDrift || 0) * 0.45).toFixed(6)),
    monitoring: {
      active: true,
      continuityState: 'self-anchored',
      watchdogSweep: Number((anchor?.phase || 0).toFixed(6)),
    },
    spinIntegerDynamics,
  };
}
