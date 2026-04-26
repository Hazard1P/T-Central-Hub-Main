import { PRIMARY_SERVER_ROUTES } from '@/lib/serverData';

const SERVER_NODE_LAYOUT = {
  'arma3-cth': { key: 'arma3', position: [-12.8, 5.0, -2.8], color: '#7fe7ff' },
  'rust-biweekly': { key: 'rust_biweekly', position: [1.8, -5.0, 4.8], color: '#d8ff61' },
  'rust-weekly': { key: 'rust_weekly', position: [8.4, -9.2, -2.0], color: '#ff9fd9' },
  'rust-monthly': { key: 'rust_monthly', position: [-8.2, -11.4, -1.8], color: '#9dd0ff' },
};

const PRIMARY_WORLD_NODES = [
  { key: 'sbox', label: 'S&Box', address: 'sbox.game', description: 'External S&Box route.', position: [2.8, 11.2, -4.2], color: '#7cd6ff', route: 'https://sbox.game/', external: true, kind: 'blackhole', priority: 7, target_server_id: null, region: 'global', mode_support: ['multi_player'], fallback_server_id: null, foundationBuilt: true },
  { key: 'matrixcoinexchange', label: 'MatrixCoinExchange', address: 'matrixcoinexchange.com', description: 'External MatrixCoinExchange route.', position: [8.6, 6.4, -3.0], color: '#6dffb5', route: 'https://matrixcoinexchange.com', external: true, kind: 'blackhole', priority: 8, target_server_id: null, region: 'global', mode_support: ['multi_player'], fallback_server_id: null, tags: ['exchange', 'settlement', 'scalar gains'], foundationBuilt: true },
  { key: 'standalone_blackhole', label: '<(BlackHole)> Standalone', address: 'Relative server anchorage core', description: 'Standalone <(BlackHole)> anchor for the cosmic map. It carries relative server anchorage, blackhole data storage, entropic storage, star-node routing, Dyson sphere handoff, and fabric-of-the-universe relativity continuity for autonomous monitoring.', position: [-2.4, 8.8, -10.4], color: '#9eb6ff', kind: 'blackhole', priority: 11, target_server_id: 'arma3-cth-primary', region: 'global', mode_support: ['single_player', 'multi_player'], fallback_server_id: 'rust-biweekly-primary', tags: ['standalone blackhole', 'relative anchorage', 'data storage', 'entropic storage', 'star nodes', 'dyson handoff', 'universe fabric relativity'], foundationBuilt: true, networkRole: 'standalone-intelligence-anchor' },
  { key: 'entropic_node', label: 'Entropic Node', address: 'Shared extraction seam', description: 'Multiplayer mining seam where entropic mass can be harvested and carried back through the blackhole-linked route shell.', position: [2.4, -1.2, -9.8], color: '#ff9a5c', kind: 'node', priority: 9, tags: ['multiplayer mining', 'entropy seam', 'mission cargo'], foundationBuilt: true },
  { key: 'deep_blackhole', label: 'Deep Space Blackhole', address: 'Primary deep-space anchor', description: 'Deep-space blackhole generated procedurally so the map and anchorage are computed from the shared universe engine instead of static artwork.', position: [-17.2, -3.6, -5.8], color: '#c4d4ff', kind: 'blackhole', priority: 6, target_server_id: 'arma3-cth-primary', region: 'us-central', mode_support: ['single_player', 'multi_player'], fallback_server_id: 'rust-weekly-primary', tags: ['deep space', 'map anchor', 'existing anchorage'], foundationBuilt: true },
  { key: 'csis', label: 'CSIS Dyson Sphere', address: 'Government of Canada / CSIS defense core', description: 'CSIS Dyson sphere synchronized to the Government of Canada CSIS authority route. Ring I handles conscious intelligence and cyberfield production, Ring II handles ingress/egress route flow, and Ring III performs encryption plus firewall monitoring across Ring I, Ring II, and Ring III itself. The sphere is system-owned, sealed to player construction, and reserved for game defense only.', position: [-6.8, 10.6, 5.8], color: '#8ff3ff', kind: 'dyson', priority: 7, tags: ['conscious intelligence ring', 'cyberfield production', 'ingress egress ring', 'encryption firewall ring', 'foundation core', 'sealed defense'], route: 'https://www.canada.ca/en/security-intelligence-service.html', external: true, dysonProfile: 'csis', foundationBuilt: true, networkRole: 'foundation-security', systemOwned: true, playerInteractive: false, playerBuildable: false, requestSurface: false, routeSurface: 'sealed' },
  { key: 'ss', label: 'Synaptics.Systems Dyson Sphere', address: 'Tri-ring encrypted stellar shell', description: 'Synaptics.Systems Dyson sphere with three astrophysics-coupled rings around its stellar core: a collector ring, a habitat ring, and an encryption ring. Its docking station remains in close proximity for ship recovery, sortie launch, and return staging.', position: [13.8, -1.4, 6.0], color: '#ffd67d', kind: 'dyson', priority: 8, tags: ['three rings', 'stellar collector', 'encryption lattice', 'dock proximity', 'ship recovery'], dysonProfile: 'synaptics', foundationBuilt: true, networkRole: 'stellar-encryption', encryptionOwned: true },
  { key: 'ss_dock', label: 'Synaptics Docking Station', address: 'Docking lane / hangar ring', description: 'Primary ship docking station stationed in proximity to the Synaptics.Systems Dyson Sphere for launch, return, and mission turn-in.', position: [16.95, -0.15, 7.45], color: '#9fe6ff', kind: 'node', priority: 8, tags: ['docking', 'hangar', 'proximity station'], structureProfile: 'docking_station', foundationBuilt: true },
  { key: 'affiliates', label: 'Affiliates', address: 'Dyson sphere', description: 'Affiliates Dyson sphere node.', position: [-10.6, -9.4, 6.4], color: '#ff9fd9', kind: 'dyson', priority: 5, foundationBuilt: true },
  { key: 'solar_system', label: 'Solar System', address: 'Sun + 9 planets', description: 'Solar system locked into the T-Central Hub zone with nine orbiting planets.', position: [7.4, 2.2, 5.0], color: '#ffd46b', kind: 'solar', priority: 4, foundationBuilt: true },
];

function createServerNode(server, index) {
  const preset = SERVER_NODE_LAYOUT[server.slug] || {};
  const fallbackRadius = 10 + index * 3.2;
  const fallbackAngle = index * 1.7;

  return {
    key: preset.key || server.statusKey || server.slug,
    label: server.shortTitle,
    address: server.ip,
    description: server.summary,
    position: preset.position || [
      Number((Math.cos(fallbackAngle) * fallbackRadius).toFixed(2)),
      Number((-5 + index * 1.5).toFixed(2)),
      Number((Math.sin(fallbackAngle) * fallbackRadius * 0.55).toFixed(2)),
    ],
    color: preset.color || '#9dd0ff',
    route: server.href,
    kind: 'blackhole',
    priority: 10 - Math.min(index, 4),
    benefactor: server.accent || server.shortTitle,
    associatedServer: server.slug,
    target_server_id: server.id,
    region: 'us-central',
    mode_support: ['multi_player'],
    fallback_server_id: 'arma3-cth-primary',
    tags: [...(server.tags || []), 'server-associated-blackhole', 'benefactor-anchor'],
    foundationBuilt: true,
  };
}

const DYNAMIC_SERVER_NODES = PRIMARY_SERVER_ROUTES.map(createServerNode);

const SATELLITE_RINGS = Number(process.env.NEXT_PUBLIC_WORLD_RINGS || 5);
const SATELLITES_PER_RING = Number(process.env.NEXT_PUBLIC_WORLD_RING_DENSITY || 6);
const SATELLITE_RADIUS_START = 16;
const SATELLITE_RADIUS_STEP = 5.25;
const SATELLITE_COLORS = ['#91f2ff', '#d3b6ff', '#ffd589', '#8cffcc', '#ff9fd9', '#9dd0ff'];

function createSatelliteNode(ringIndex, satelliteIndex) {
  const radius = SATELLITE_RADIUS_START + ringIndex * SATELLITE_RADIUS_STEP;
  const angle = (Math.PI * 2 * satelliteIndex) / SATELLITES_PER_RING + ringIndex * 0.42;
  const verticalWave = ((satelliteIndex % 3) - 1) * 2.8 + ringIndex * 0.35;

  return {
    key: `aux-${ringIndex + 1}-${satelliteIndex + 1}`,
    label: `Aux Node ${ringIndex + 1}.${satelliteIndex + 1}`,
    address: `Expansion ring ${ringIndex + 1}`,
    description: 'Procedurally generated relay node for infinite-feeling world expansion and future route growth.',
    position: [
      Number((Math.cos(angle) * radius).toFixed(2)),
      Number(verticalWave.toFixed(2)),
      Number((Math.sin(angle) * radius * 0.72).toFixed(2)),
    ],
    color: SATELLITE_COLORS[(ringIndex + satelliteIndex) % SATELLITE_COLORS.length],
    kind: 'node',
    priority: 1,
    generated: true,
    foundationBuilt: false,
  };
}

const GENERATED_SATELLITE_NODES = Array.from({ length: SATELLITE_RINGS * SATELLITES_PER_RING }, (_, index) => {
  const ringIndex = Math.floor(index / SATELLITES_PER_RING);
  const satelliteIndex = index % SATELLITES_PER_RING;
  return createSatelliteNode(ringIndex, satelliteIndex);
});

function createPeripheralBlackhole(index) {
  const radius = 22 + index * 4.2;
  const angle = index * 1.05 + 0.35;
  const height = ((index % 4) - 1.5) * 3.1;
  const palette = ['#7fe7ff', '#c4d4ff', '#9f9bff', '#6dffb5', '#ff9fd9', '#ffd67d'];

  return {
    key: `perimeter_blackhole_${index + 1}`,
    label: `Perimeter Blackhole ${index + 1}`,
    address: `Outer event horizon ${index + 1}`,
    description: 'Distributed blackhole anchor with its own local event horizon and string-light lensing shell, spread across the wider map fabric to extend deep-space coverage.',
    position: [
      Number((Math.cos(angle) * radius).toFixed(2)),
      Number(height.toFixed(2)),
      Number((Math.sin(angle) * radius * 0.8).toFixed(2)),
    ],
    color: palette[index % palette.length],
    kind: 'blackhole',
    priority: 2,
    generated: true,
    target_server_id: null,
    region: 'global',
    mode_support: ['single_player'],
    fallback_server_id: null,
    foundationBuilt: true,
    tags: ['distributed anchor', 'event horizon', 'string of light'],
  };
}

const PERIMETER_BLACKHOLES = Array.from({ length: 8 }, (_, index) => createPeripheralBlackhole(index));

export const WORLD_LAYOUT = [...PRIMARY_WORLD_NODES, ...DYNAMIC_SERVER_NODES, ...PERIMETER_BLACKHOLES, ...GENERATED_SATELLITE_NODES];

export const ROUTE_CHIPS = WORLD_LAYOUT
  .filter((node) => ['blackhole', 'dyson', 'solar'].includes(node.kind))
  .map((node) => node.label);

export const WORLD_SUMMARY = WORLD_LAYOUT.reduce(
  (summary, node) => {
    if (node.kind === 'blackhole') summary.blackholes += 1;
    if (node.kind === 'dyson') summary.dysonSpheres += 1;
    if (node.kind === 'solar') summary.solarSystems += 1;
    if (node.kind === 'node') summary.nodes += 1;
    return summary;
  },
  { blackholes: 0, dysonSpheres: 0, solarSystems: 0, nodes: 0 }
);
