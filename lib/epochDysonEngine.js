export const REAL_LIFE_GAME_DAY_COUNT = 5;
export const REAL_LIFE_DAY_MS = 24 * 60 * 60 * 1000;
export const REAL_LIFE_GAME_WINDOW_MS = REAL_LIFE_GAME_DAY_COUNT * REAL_LIFE_DAY_MS;

export function getUnixEpochSeconds(now = Date.now()) {
  return Math.floor(now / 1000);
}

function normalizeUnit(value) {
  const normalized = value % 1;
  return normalized < 0 ? normalized + 1 : normalized;
}

function normalizePlayableTime(value = Date.now()) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Date.now();
}

export function createRealLifeGameDayAnchor({ now = Date.now(), playableAt = now } = {}) {
  const currentMs = normalizePlayableTime(now);
  const requestedMs = normalizePlayableTime(playableAt);
  const anchoredMs = Math.max(requestedMs, currentMs);
  const currentDayIndex = Math.floor(currentMs / REAL_LIFE_DAY_MS);
  const playableDayIndex = Math.floor(anchoredMs / REAL_LIFE_DAY_MS);
  const dayOffset = Math.max(0, playableDayIndex - currentDayIndex);
  const cycleIndex = playableDayIndex % REAL_LIFE_GAME_DAY_COUNT;
  const cycleStartDayIndex = playableDayIndex - cycleIndex;
  const cycleStartMs = cycleStartDayIndex * REAL_LIFE_DAY_MS;
  const cycleEndMs = cycleStartMs + REAL_LIFE_GAME_WINDOW_MS;

  return {
    enabled: true,
    design: '5-real-life-day-rolling-anchor',
    dayCount: REAL_LIFE_GAME_DAY_COUNT,
    playable: true,
    currentDay: new Date(currentDayIndex * REAL_LIFE_DAY_MS).toISOString().slice(0, 10),
    playableDay: new Date(playableDayIndex * REAL_LIFE_DAY_MS).toISOString().slice(0, 10),
    dayOffset,
    cycleIndex,
    cycleDay: cycleIndex + 1,
    cycleStart: new Date(cycleStartMs).toISOString(),
    cycleEnd: new Date(cycleEndMs).toISOString(),
    anchorUnix: getUnixEpochSeconds(cycleStartMs),
    playableUnix: getUnixEpochSeconds(anchoredMs),
    multiplayerScope: `rl5:${cycleStartDayIndex}:${playableDayIndex}`,
  };
}

export function createEpochAnchor({ now = Date.now(), playableAt = now, solarSystemKey = 'solar_system', dysonKey = 'ss' } = {}) {
  const realLifeGameDay = createRealLifeGameDayAnchor({ now, playableAt });
  const anchorMs = realLifeGameDay.playableUnix * 1000;
  const unix = getUnixEpochSeconds(anchorMs);
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
    realLifeGameDay,
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
    realLifeGameDay: anchor.realLifeGameDay || null,
  };
}
