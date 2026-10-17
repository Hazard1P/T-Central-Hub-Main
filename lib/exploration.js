export const EXPLORATION_LANDMARKS = [
  { key: 'halcyon', label: 'Halcyon', kind: 'planet', position: [34, 15, 96], radius: 18, color: '#ddb787', description: 'A banded gas giant surrounded by pale ice rings. Approach from outside the rings for a clear view.', approachRadius: 39 },
  { key: 'pelagos', label: 'Pelagos', kind: 'planet', position: [-44, -12, 135], radius: 22, color: '#64c8d5', description: 'An ocean world beneath a luminous blue atmosphere. Explore its day and night sides from orbit.', approachRadius: 29 },
  { key: 'asteroid_belt', label: 'The Drift', kind: 'asteroid field', position: [0, -7, 82], radius: 3, color: '#a9bdce', description: 'A scattered belt of ancient rock beyond the hub. A quiet place to rendezvous with other pilots.', approachRadius: 6 },
];

export const isValidRoomName = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);

export function distanceBetween(a = [0, 0, 0], b = [0, 0, 0]) {
  return Math.hypot(...a.map((value, index) => value - b[index]));
}

export function getExplorationDestinations(nodes = []) {
  const order = { planet: 0, 'asteroid field': 1, solar: 2, node: 3, dyson: 4, blackhole: 5 };
  return [...nodes.filter((node) => node.playerInteractive !== false && !(node.generated && node.kind === 'node') && ['solar', 'blackhole', 'dyson', 'node'].includes(node.kind))
    .map((node) => ({ ...node, radius: node.kind === 'solar' ? 3 : node.kind === 'dyson' ? 3 : 1.5, approachRadius: node.kind === 'solar' ? 12 : node.kind === 'dyson' ? 7 : 5 })), ...EXPLORATION_LANDMARKS]
    .sort((a, b) => (order[a.kind] ?? 6) - (order[b.kind] ?? 6));
}

export function getPilotSpawn(id = '') {
  let hash = 0;
  for (const char of String(id)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const angle = (hash % 360) * Math.PI / 180;
  const radius = 5 + (hash % 4);
  return [Number((Math.cos(angle) * radius).toFixed(3)), Number(((hash % 5) - 2).toFixed(3)), Number((18 + Math.sin(angle) * radius).toFixed(3))];
}

export function getApproachPoint(position, destination) {
  const delta = position.map((value, index) => value - destination.position[index]);
  const length = Math.hypot(...delta);
  let direction = length > .001 ? delta.map((value) => value / length) : [0, 0, 1];
  const radius = destination.approachRadius || (destination.radius || 2) + 3;
  let point = destination.position.map((value, index) => value + direction[index] * radius);
  if (Math.abs(point[0]) > 154 || Math.abs(point[1]) > 114 || Math.abs(point[2]) > 154) {
    const towardOrigin = Math.hypot(...destination.position) || 1;
    direction = destination.position.map((value) => -value / towardOrigin);
    point = destination.position.map((value, index) => value + direction[index] * radius);
  }
  return point;
}

// A velocity controller expressed as ordinary thrust, so solo and shared flight use the same controls.
export function getCruiseControl({ position, velocity, target, gravity = [0, 0, 0], braking = false }) {
  const delta = target.map((value, index) => value - position[index]);
  const distance = Math.hypot(...delta);
  const desiredSpeed = braking ? 0 : Math.min(8, distance * .85);
  const control = delta.map((value, index) => (((distance > .001 ? value / distance : 0) * desiredSpeed - velocity[index]) * 2.2 - gravity[index]) / 8.8);
  const magnitude = Math.hypot(...control);
  return control.map((value) => value * (magnitude > 1.75 ? 1.75 / magnitude : 1));
}
