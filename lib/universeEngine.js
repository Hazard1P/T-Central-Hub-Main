import { WORLD_LAYOUT } from '@/lib/worldLayout';
import { PRIMARY_SERVER_ROUTES } from '@/lib/serverData';
import { createEpochAnchor, computeOrbitFromEpoch } from '@/lib/epochDysonEngine';
import { buildEpochPlanetarySystem } from '@/lib/planetarySystemEngine';
import { getServerUniverseAnchor } from '@/lib/serverAnchor';

const DEFAULT_ROUTE_COLORS = ['#7fe7ff', '#9f7cff', '#6dffb5', '#ffd46b', '#ff9fd9', '#9dd0ff'];

function distanceBetween(a = [0, 0, 0], b = [0, 0, 0]) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function buildCsisState(nodes, epochAnchor) {
  const csis = nodes.find((node) => node.key === 'csis');
  if (!csis) {
    return {
      linkedNodeKeys: [],
      quarantinedNodeKeys: [],
      authorizedNodeKeys: [],
      firewallSweep: 0,
      linkagePulse: 0,
      ringOneLabel: 'Network linkage',
      ringTwoLabel: 'Foundation firewall',
      playerAccess: 'sealed',
      acceptsPlayerBuilds: false,
      acceptsPlayerRequests: false,
      defenseScope: 'game-core',
    };
  }

  const authorizedNodes = nodes.filter((node) => node.foundationBuilt && node.key !== csis.key);
  const unauthorizedNodes = nodes.filter((node) => !node.foundationBuilt && node.key !== csis.key);
  const linkedNodeKeys = authorizedNodes
    .filter((node) => ['blackhole', 'dyson', 'solar'].includes(node.kind) || node.key === 'ss_dock' || node.key === 'matrixcoinexchange')
    .map((node) => node.key);

  const firewallSweep = Number((((epochAnchor?.phase || 0) * Math.PI * 2) % (Math.PI * 2)).toFixed(4));
  const linkagePulse = Number((0.5 + (epochAnchor?.dysonAlignment || 0) * 0.5).toFixed(4));
  const quarantinedNodeKeys = unauthorizedNodes
    .filter((node) => distanceBetween(node.position, csis.position) <= 24)
    .map((node) => node.key);

  return {
    linkedNodeKeys,
    quarantinedNodeKeys,
    authorizedNodeKeys: authorizedNodes.map((node) => node.key),
    firewallSweep,
    linkagePulse,
    ringOneLabel: 'Network linkage',
    ringTwoLabel: 'Foundation firewall',
    playerAccess: 'sealed',
    acceptsPlayerBuilds: false,
    acceptsPlayerRequests: false,
    defenseScope: 'game-core',
  };
}

function round(n) {
  return Number(n.toFixed(2));
}

function classifyNode(node) {
  if (node.kind === 'solar') return 'solar';
  if (node.kind === 'dyson') return 'anchor';
  if (node.kind === 'blackhole') return node.route ? 'portal' : 'anchor';
  if ((node.tags || []).includes('rust')) return 'server';
  return node.generated ? 'relay' : 'node';
}

function createSolarChildren(node, index, epochAnchor) {
  if (node.kind !== 'solar') return [];
  if (Array.isArray(node.orbiters) && node.orbiters.length) return node.orbiters;

  const orbitCount = 6;
  return Array.from({ length: orbitCount }, (_, orbitIndex) => {
    const angle = (Math.PI * 2 * orbitIndex) / orbitCount + index * 0.35;
    const radius = 2.2 + orbitIndex * 0.85;
    const orbitEpoch = computeOrbitFromEpoch({ orbitIndex, baseSpeed: 0.12 + orbitIndex * 0.02, anchor: epochAnchor });
    return {
      key: `${node.key}-planet-${orbitIndex + 1}`,
      parentKey: node.key,
      label: `Planet ${orbitIndex + 1}`,
      kind: 'planet',
      radius: round(radius),
      speed: round(orbitEpoch.angularVelocity),
      size: round(0.16 + orbitIndex * 0.035),
      tilt: round(((orbitIndex % 3) - 1) * 0.18),
      seedAngle: round(angle + orbitEpoch.phaseOffset * Math.PI * 2),
      color: DEFAULT_ROUTE_COLORS[(orbitIndex + 2) % DEFAULT_ROUTE_COLORS.length],
    };
  });
}

export function buildUniverseGraph(now = Date.now(), options = {}) {
  const epochAnchor = createEpochAnchor({ now });
  const serverAnchor = getServerUniverseAnchor();
  const extraNodes = Array.isArray(options.extraNodes) ? options.extraNodes : [];
  const extraRouteLinks = Array.isArray(options.extraRouteLinks) ? options.extraRouteLinks : [];
  const lobbyMode = options.lobbyMode || 'hub';
  const roomName = options.roomName || process.env.NEXT_PUBLIC_MULTIPLAYER_ROOM || 'tcentral-main';
  const hubStarSystem = lobbyMode === 'hub' ? buildEpochPlanetarySystem({
    keyPrefix: 'shared_hub_system',
    seed: `${roomName}:${Math.floor(Number(now)/1000/900)}`,
    now,
    center: [22.5, 1.8, -14.5],
    starLabel: 'Shared Hub Star',
    starColor: '#ffe18d',
    scope: 'hub',
    ownerAlias: 'Shared Hub',
    foundationBuilt: true,
    privateOnly: false,
    networkMode: 'unix-epoch-rolling-shared-discrepant',
    serverAnchor,
  }) : null;
  const layout = [...WORLD_LAYOUT, ...(hubStarSystem?.nodes || []), ...extraNodes];

  const nodes = layout.map((node, index) => ({
    ...node,
    category: classifyNode(node),
    intensity:
      node.kind === 'blackhole' ? 1.1 :
      node.kind === 'solar' ? 0.85 :
      node.kind === 'dyson' ? 0.72 :
      node.generated ? 0.32 : 0.45,
    radius:
      node.kind === 'blackhole' ? 1.9 :
      node.kind === 'solar' ? 1.55 :
      node.kind === 'dyson' ? 1.18 :
      node.generated ? 0.24 : 0.42,
    mass:
      node.kind === 'blackhole' ? 440 - index * 6 :
      node.kind === 'solar' ? 190 :
      node.kind === 'dyson' ? 125 : 18,
    curvature:
      node.kind === 'blackhole' ? 1 :
      node.kind === 'solar' ? 0.58 :
      node.kind === 'dyson' ? 0.42 : 0.12,
    stateVectorSeed: (index + 1) * 0.73,
    anchorType: node.mapAsset || node.seedAsset ? 'mapped-anchor' : node.kind,
    epochAnchor: node.kind === 'solar' || node.kind === 'dyson' ? epochAnchor : null,
    orbiters: createSolarChildren(node, index, epochAnchor),
  }));

  const primaryAnchors = nodes.filter((node) => ['blackhole', 'solar', 'dyson'].includes(node.kind));
  const routeLinks = [];
  const csisState = buildCsisState(nodes, epochAnchor);

  const deepAnchor = nodes.find((node) => node.key === 'deep_blackhole');
  const solarAnchor = nodes.find((node) => node.kind === 'solar');
  const ssAnchor = nodes.find((node) => node.key === 'ss');
  const ssDock = nodes.find((node) => node.key === 'ss_dock');
  const csisAnchor = nodes.find((node) => node.key === 'csis');
  const rustServers = PRIMARY_SERVER_ROUTES.filter((server) => server.family === 'rust');
  const armaServer = PRIMARY_SERVER_ROUTES.find((server) => server.slug === 'arma3-cth');

  if (deepAnchor && hubStarSystem?.starKey) {
    routeLinks.push({
      key: 'deep-to-shared-hub-star',
      from: deepAnchor.key,
      to: hubStarSystem.starKey,
      color: '#ffe8aa',
      arc: 2.15,
      weight: 0.88,
    });
  }

  if (deepAnchor && solarAnchor) {
    routeLinks.push({
      key: 'deep-to-solar',
      from: deepAnchor.key,
      to: solarAnchor.key,
      color: '#7fe7ff',
      arc: 2.6,
      weight: 1.25,
    });
  }

  if (deepAnchor && armaServer) {
    routeLinks.push({
      key: 'deep-to-arma3',
      from: deepAnchor.key,
      to: armaServer.statusKey,
      color: '#6dffb5',
      arc: 2.1,
      weight: 1.35,
    });
  }


  if (ssAnchor && ssDock) {
    routeLinks.push({
      key: 'ss-to-dock',
      from: ssAnchor.key,
      to: ssDock.key,
      color: '#9fe6ff',
      arc: 0.95,
      weight: 0.95,
    });
  }

  if (csisAnchor) {
    csisState.linkedNodeKeys.forEach((key, index) => {
      if (key === csisAnchor.key) return;
      routeLinks.push({
        key: `csis-link-${key}`,
        from: csisAnchor.key,
        to: key,
        color: index % 2 === 0 ? '#7fe7ff' : '#c9f6ff',
        arc: 1.05 + (index % 4) * 0.24,
        weight: 0.82,
        linkage: true,
        internalOnly: true,
        playerTraversable: false,
      });
    });
  }

  rustServers.forEach((server, index) => {
    routeLinks.push({
      key: `rust-link-${server.slug}`,
      from: deepAnchor?.key || 'deep_blackhole',
      to: server.statusKey,
      color: DEFAULT_ROUTE_COLORS[(index + 1) % DEFAULT_ROUTE_COLORS.length],
      arc: 1.6 + index * 0.3,
      weight: 1.1,
    });
  });

  const generatedRelays = nodes.filter((node) => node.generated).slice(0, 18);
  generatedRelays.forEach((relay, index) => {
    const target = primaryAnchors[index % primaryAnchors.length];
    if (!target) return;
    routeLinks.push({
      key: `relay-${relay.key}`,
      from: relay.key,
      to: target.key,
      color: relay.color || '#9dd0ff',
      arc: 0.8 + (index % 4) * 0.25,
      weight: 0.45,
      faint: true,
    });
  });

  (hubStarSystem?.routeLinks || []).forEach((link) => {
    if (!link?.from || !link?.to) return;
    routeLinks.push(link);
  });

  extraRouteLinks.forEach((link) => {
    if (!link?.from || !link?.to) return;
    if (!nodes.some((node) => node.key === link.from) || !nodes.some((node) => node.key === link.to)) return;
    routeLinks.push(link);
  });

  const securedNodes = nodes.map((node) => ({
    ...node,
    securityState:
      node.key === 'csis' ? 'core' :
      node.privateOnly ? 'private-sealed' :
      csisState.linkedNodeKeys.includes(node.key) ? 'linked' :
      csisState.quarantinedNodeKeys.includes(node.key) ? 'quarantined' :
      node.foundationBuilt ? 'foundation' : 'open',
  }));

  const heroNodes = securedNodes
    .filter((node) => ['blackhole', 'solar', 'dyson'].includes(node.kind) || PRIMARY_SERVER_ROUTES.some((server) => server.statusKey === node.key))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  return {
    nodes: securedNodes,
    epochAnchor,
    heroNodes,
    routeLinks,
    primaryAnchors,
    csisState,
    stats: {
      blackholes: nodes.filter((node) => node.kind === 'blackhole').length,
      solarSystems: nodes.filter((node) => node.kind === 'solar').length,
      dysonSpheres: nodes.filter((node) => node.kind === 'dyson').length,
      relays: nodes.filter((node) => node.generated).length,
    },
  };
}

export function getNodePositionMap(graph) {
  return Object.fromEntries(graph.nodes.map((node) => [node.key, node.position]));
}
