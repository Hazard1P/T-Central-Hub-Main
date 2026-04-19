export const DEFAULT_FLIGHT_STATS = {
  position: [0, 0, 0],
  velocity: [0, 0, 0],
  speed: 0,
  boosting: false,
  boostLevel: 100,
  gravityTarget: 'None',
  zone: 'Navigation',
  mode: 'spectate',
};

export function normalizeFlightStats(next) {
  if (!next || typeof next !== 'object') return { ...DEFAULT_FLIGHT_STATS };

  const position = Array.isArray(next.position) && next.position.length >= 3
    ? [Number(next.position[0]) || 0, Number(next.position[1]) || 0, Number(next.position[2]) || 0]
    : [...DEFAULT_FLIGHT_STATS.position];

  const velocity = Array.isArray(next.velocity) && next.velocity.length >= 3
    ? [Number(next.velocity[0]) || 0, Number(next.velocity[1]) || 0, Number(next.velocity[2]) || 0]
    : [...DEFAULT_FLIGHT_STATS.velocity];

  return {
    ...DEFAULT_FLIGHT_STATS,
    ...next,
    position,
    velocity,
    speed: Number(next.speed) || 0,
    boostLevel: Number(next.boostLevel) || DEFAULT_FLIGHT_STATS.boostLevel,
    boosting: Boolean(next.boosting),
    gravityTarget: next.gravityTarget || DEFAULT_FLIGHT_STATS.gravityTarget,
    zone: next.zone || DEFAULT_FLIGHT_STATS.zone,
    mode: next.mode || DEFAULT_FLIGHT_STATS.mode,
  };
}

export function getSafePosition(stats) {
  const normalized = normalizeFlightStats(stats);
  return normalized.position;
}
