export const WORLD_LIMIT = 1_000_000_000;
export const MAX_FLIGHT_SPEED = 4_000_000;
export const SOLAR_UNITS_PER_AU = 2_000_000;
export const SOLAR_WORLD_CENTER = Object.freeze([24_000, 1600, 12_000]);
export const RENDER_DISTANCE = 100_000;
export const UNIVERSE_LANDMARKS = [
  { key: 'halcyon', label: 'Halcyon', kind: 'planet', position: [34, 15, 96], radius: 18, color: '#ddb787', description: 'A banded gas giant surrounded by pale ice rings. Approach from outside the rings for a clear view.', approachRadius: 39 },
  { key: 'pelagos', label: 'Pelagos', kind: 'planet', position: [-44, -12, 135], radius: 22, color: '#64c8d5', description: 'An ocean world beneath a luminous blue atmosphere. Explore its day and night sides from orbit.', approachRadius: 29 },
  { key: 'asteroid_belt', label: 'The Drift', kind: 'asteroid field', position: [0, -7, 82], radius: 3, color: '#a9bdce', description: 'A scattered belt of ancient rock beyond the hub. A quiet place to rendezvous with other pilots.', approachRadius: 6 },
];
export function floatingOrigin(position) {
  return position.map(value => Math.round(value / 1000) * 1000);
}
export function formatSpaceDistance(distance) {
  if (distance >= SOLAR_UNITS_PER_AU * .01) return (distance / SOLAR_UNITS_PER_AU).toFixed(3) + ' AU';
  return distance.toLocaleString('en-US', { maximumFractionDigits: distance < 1000 ? 1 : 0 }) + ' u';
}

// Preserve elapsed flight time on slower renderers; each input stays within server limits.
export function flightSubsteps(delta) {
  const elapsed = Math.max(1 / 240, Math.min(Number.isFinite(delta) ? delta : 1 / 60, .25));
  const count = Math.ceil(elapsed / (1 / 30));
  return Array(count).fill(elapsed / count);
}
