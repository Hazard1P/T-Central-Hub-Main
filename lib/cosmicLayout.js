// Shared world coordinates for rendering, navigation, map assets and flight gravity.
export const COSMIC_POSITIONS = Object.freeze({
  solar_system: [70, 18, 42],
  deep_blackhole: [-112, -28, 6],
  standalone_blackhole: [-28, 56, -104],
  sbox: [28, 68, -62],
  csis: [88, 44, -64],
  ss: [-78, 22, 62],
  ss_dock: [-74.85, 23.25, 63.45],
  affiliates: [-82, -44, -76],
  entropic_node: [-14, -26, -54],
  arma3: [-92, 6, 112],
  rust_biweekly: [108, -46, 88],
  rust_weekly: [108, -28, -104],
  rust_monthly: [-108, -52, -108],
  ember_star: [-68, 56, 6],
  sapphire_star: [24, -50, -106],
  haven_star: [112, 30, 4],
  north_star: [-20, 66, 106],
  shared_hub_system_star: [-22, -38, 46],
});
export const PERIMETER_POSITIONS = [
  [132, 54, 112], [-130, -62, 76], [72, 62, -132], [-66, 10, -136],
  [132, -62, -24], [-134, 60, -42], [8, -66, 136], [8, 68, -132],
];
export const SOLAR_TRANSFER_RADIUS = 13;

export const COSMIC_STAR_SYSTEMS = [
  { key: 'ember_star', label: 'Ember Reach', color: '#ffb36f', stellarClass: 'M2V' },
  { key: 'sapphire_star', label: 'Sapphire Expanse', color: '#aabfff', stellarClass: 'B9V' },
  { key: 'haven_star', label: 'Haven Star', color: '#ffd2a1', stellarClass: 'K1V' },
  { key: 'north_star', label: 'Northlight System', color: '#f8f7ff', stellarClass: 'F6V' },
].map(star => ({ ...star, kind: 'solar', position: COSMIC_POSITIONS[star.key], address: 'Outer stellar region', description: 'A fictional stellar system in the shared explorable universe. Its illustrated planets orbit a procedural star.', priority: 3, foundationBuilt: true }));

export function spreadCosmicNode(node) {
  if (COSMIC_POSITIONS[node.key]) return { ...node, position: [...COSMIC_POSITIONS[node.key]] };
  if (node.key.startsWith('perimeter_blackhole_')) {
    const position = PERIMETER_POSITIONS[Number(node.key.split('_').at(-1)) - 1];
    if (position) return { ...node, position: [...position] };
  }
  if (node.key.startsWith('aux-')) {
    const [, ringText, spokeText] = node.key.split('-'), ring = Number(ringText), spoke = Number(spokeText);
    const radius = 65 + ring * 12, angle = spoke * Math.PI / 3 + ring * .47;
    return { ...node, position: [Math.cos(angle) * radius, Math.sin(spoke * 1.7 + ring) * 62, Math.sin(angle) * radius].map(v => Number(v.toFixed(3))) };
  }
  return node;
}

export function shouldTransferToSolar(position, { inSolar = false, blocked = false } = {}) {
  return !inSolar && !blocked && Array.isArray(position) && position.length === 3 && position.every(Number.isFinite)
    && Math.hypot(...position.map((v, i) => v - COSMIC_POSITIONS.solar_system[i])) <= SOLAR_TRANSFER_RADIUS;
}

export const COSMIC_GRAVITY_SOURCES = [
  ...Object.entries(COSMIC_POSITIONS).filter(([key]) => key !== 'ss_dock' && key !== 'entropic_node' && key !== 'shared_hub_system_star').map(([key, position]) => {
    const solar = key === 'solar_system' || COSMIC_STAR_SYSTEMS.some(star => star.key === key);
    const dyson = ['ss', 'csis', 'affiliates'].includes(key);
    return { key, kind: solar ? 'solar' : dyson ? 'dyson' : 'blackhole', mass: solar ? 190 : dyson ? 125 : key === 'deep_blackhole' ? 440 : 140, position, influenceRadius: solar ? 20 : 16 };
  }),
  ...PERIMETER_POSITIONS.map((position, i) => ({ key: `perimeter_blackhole_${i + 1}`, kind: 'blackhole', mass: 110, position, influenceRadius: 16 })),
];
