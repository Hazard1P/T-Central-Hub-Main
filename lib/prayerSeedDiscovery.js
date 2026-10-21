import { UNIVERSE_LANDMARKS } from './universeSpace.js';
import { celestialMetrics } from './celestialScale.js';
import { getSolarSpawn } from './universeFlight.js';
// Keep the quiet discovery just outside Halcyon's enlarged rings.
// Deliberately absent from the public destination catalog.
const halcyon = UNIVERSE_LANDMARKS.find(node => node.key === 'halcyon');
const referenceSpawn = getSolarSpawn('', Date.UTC(2026, 9, 20));
const offset = referenceSpawn.map((v, i) => v - halcyon.position[i]);
const distance = Math.hypot(...offset);
export const PRAYER_RELIC_POSITION = Object.freeze(halcyon.position.map((v, i) => v + offset[i] / distance * celestialMetrics(halcyon).approachRadius));
export const PRAYER_RELIC_RADIUS = 5;
export const PRAYER_SEED_MAX_LENGTH = 320;

export function isNearPrayerRelic(position) {
  return Array.isArray(position) && position.length === 3
    && position.every((value) => typeof value === 'number' && Number.isFinite(value))
    && Math.hypot(...position.map((value, index) => value - PRAYER_RELIC_POSITION[index])) <= PRAYER_RELIC_RADIUS;
}
