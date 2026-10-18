// Deliberately absent from the destination catalog: a quiet discovery near Halcyon.
export const PRAYER_RELIC_POSITION = Object.freeze([18.7, 8.3, 60]);
export const PRAYER_RELIC_RADIUS = 5;
export const PRAYER_SEED_MAX_LENGTH = 320;

export function isNearPrayerRelic(position) {
  return Array.isArray(position) && position.length === 3
    && position.every((value) => typeof value === 'number' && Number.isFinite(value))
    && Math.hypot(...position.map((value, index) => value - PRAYER_RELIC_POSITION[index])) <= PRAYER_RELIC_RADIUS;
}
