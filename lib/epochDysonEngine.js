export function getUnixEpochSeconds(now = Date.now()) {
  return Math.floor(now / 1000);
}

function normalizeUnit(value) {
  const normalized = value % 1;
  return normalized < 0 ? normalized + 1 : normalized;
}

export function createEpochAnchor({ now = Date.now(), solarSystemKey = 'solar_system', dysonKey = 'ss' } = {}) {
  const unix = getUnixEpochSeconds(now);
  const solarPhase = normalizeUnit(unix / 86400);
  const dysonAlignment = normalizeUnit(unix / 43200 + 0.125);
  const siderealDrift = normalizeUnit(unix / 86164);
  const matrixScalar = Number((0.5 + Math.sin(unix / 377) * 0.25 + Math.cos(unix / 977) * 0.15).toFixed(6));

  return {
    unix,
    solarSystemKey,
    dysonKey,
    phase: Number(solarPhase.toFixed(6)),
    dysonAlignment: Number(dysonAlignment.toFixed(6)),
    siderealDrift: Number(siderealDrift.toFixed(6)),
    matrixScalar,
  };
}

export function computeOrbitFromEpoch({ orbitIndex = 0, baseSpeed = 0.12, anchor }) {
  const phaseSeed = anchor?.phase || 0;
  const dyson = anchor?.dysonAlignment || 0;
  const sidereal = anchor?.siderealDrift || 0;
  return {
    phaseOffset: Number(normalizeUnit(phaseSeed + orbitIndex * 0.133 + dyson * 0.21).toFixed(6)),
    angularVelocity: Number((baseSpeed * (1 + orbitIndex * 0.08) * (0.84 + sidereal * 0.3)).toFixed(6)),
  };
}

export function summarizeEpochRelativity(anchor) {
  return {
    unix: anchor.unix,
    phasePercent: Math.round((anchor.phase || 0) * 100),
    dysonPercent: Math.round((anchor.dysonAlignment || 0) * 100),
    siderealPercent: Math.round((anchor.siderealDrift || 0) * 100),
    matrixScalar: anchor.matrixScalar,
  };
}
