export const WORLD_LIMIT = 800_000_000;
export const MAX_FLIGHT_SPEED = 4_000_000;
export const SOLAR_UNITS_PER_AU = 4_000_000;
export const SOLAR_WORLD_CENTER = Object.freeze([24_000, 1600, 12_000]);
// Compress outer travel distances around the Sun; body sizes and the real
// Solar System's AU conversion retain their existing exploration scale.
export const DEEP_SPACE_DISTANCE_SCALE = 0.8;
export const contractDeepSpacePosition = position => position.map((v, i) =>
  SOLAR_WORLD_CENTER[i] + (v - SOLAR_WORLD_CENTER[i]) * DEEP_SPACE_DISTANCE_SCALE);
export const RENDER_DISTANCE = 100_000;
export const UNIVERSE_LANDMARKS = [
  { key: 'halcyon', label: 'Halcyon', kind: 'planet', position: [190_000_000, 30_000_000, 96_000_000], radius: 7200, color: '#ddb787', description: 'A fictional deep-space gas giant surrounded by pale ice rings. Approach from outside the rings for a clear view.' },
  { key: 'pelagos', label: 'Pelagos', kind: 'planet', position: [-190_000_000, -24_000_000, 135_000_000], radius: 6600, color: '#64c8d5', description: 'A fictional ocean world beneath a luminous blue atmosphere. Explore its day and night sides from orbit.' },
  { key: 'asteroid_belt', label: 'The Drift', kind: 'asteroid field', position: [70_000_000, -7_000_000, 120_000_000], radius: 3000, color: '#a9bdce', description: 'A scattered belt of ancient rock beyond the Solar System. A quiet place to rendezvous with other pilots.', approachRadius: 4500 },
].map(body => ({ ...body, position: contractDeepSpacePosition(body.position) }));
export function floatingOrigin(position) {
  return position.map(value => Math.round(value / 1000) * 1000);
}
export function formatSpaceDistance(distance) {
  if (distance >= SOLAR_UNITS_PER_AU * .01) return (distance / SOLAR_UNITS_PER_AU).toFixed(3) + ' AU';
  return distance.toLocaleString('en-US', { maximumFractionDigits: distance < 1000 ? 1 : 0 }) + ' u';
}
export function formatFlightSpeed(speed = 0) {
  const value = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  return value >= 1_000_000 ? (value / 1_000_000).toFixed(2) + 'M'
    : value >= 1_000 ? (value / 1_000).toFixed(1) + 'k' : value.toFixed(1);
}

// Preserve elapsed flight time on slower renderers; each input stays within server limits.
export function flightSubsteps(delta) {
  const elapsed = Math.max(1 / 240, Math.min(Number.isFinite(delta) ? delta : 1 / 60, .25));
  const count = Math.ceil(elapsed / (1 / 60));
  return Array(count).fill(elapsed / count);
}
