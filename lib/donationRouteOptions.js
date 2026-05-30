import { PRIMARY_SERVER_ROUTES } from './serverData.js';
import { WORLD_LAYOUT } from './worldLayout.js';

export const FALLBACK_DONATION_ANCHOR = Object.freeze({
  label: 'Deep Space Blackhole',
  anchorSlug: 'deep_blackhole',
  solarSystemKey: 'solar_system',
  route: {
    key: 'deep_blackhole',
    href: null,
    external: false,
    targetServerId: null,
    fallbackServerId: null,
  },
  category: 'blackhole',
  metadata: {
    source: 'fallback',
    tags: ['fallback', 'deep-space'],
  },
});

export const FALLBACK_DONATION_SOLAR_SYSTEM = Object.freeze({
  label: 'Primary Solar System',
  anchorSlug: 'deep_blackhole',
  solarSystemKey: 'solar_system',
  route: {
    key: 'solar_system',
    href: null,
    external: false,
    targetServerId: null,
    fallbackServerId: null,
  },
  category: 'solar',
  metadata: {
    source: 'fallback',
    tags: ['fallback', 'solar-system'],
  },
});

function normalizeDonationKey(value, fallback) {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 64) || fallback;
}

function getServerById(serverId, servers = PRIMARY_SERVER_ROUTES) {
  return servers.find((server) => server.id === serverId) || null;
}

function getServerBySlug(slug, servers = PRIMARY_SERVER_ROUTES) {
  return servers.find((server) => server.slug === slug) || null;
}

function createDonationRouteMetadata(node = {}, server = null) {
  return {
    key: node.key || server?.slug || null,
    href: node.route || server?.href || null,
    external: Boolean(node.external),
    targetServerId: node.target_server_id || server?.id || null,
    fallbackServerId: node.fallback_server_id || null,
    statusKey: server?.statusKey || null,
    serverSlug: server?.slug || node.associatedServer || null,
  };
}

function serializeDonationAnchor(node, { servers = PRIMARY_SERVER_ROUTES, defaultSolarSystemKey = 'solar_system' } = {}) {
  if (!node?.key || !node?.label) return null;
  const server = getServerBySlug(node.associatedServer, servers) || getServerById(node.target_server_id, servers);
  const anchorSlug = normalizeDonationKey(node.associatedServer || node.key, FALLBACK_DONATION_ANCHOR.anchorSlug);

  return {
    label: node.label,
    anchorSlug,
    solarSystemKey: normalizeDonationKey(node.solarSystemKey || defaultSolarSystemKey, FALLBACK_DONATION_SOLAR_SYSTEM.solarSystemKey),
    route: createDonationRouteMetadata(node, server),
    category: node.kind || 'route',
    metadata: {
      source: 'world-layout',
      priority: node.priority ?? null,
      region: node.region || 'global',
      tags: Array.isArray(node.tags) ? [...node.tags] : [],
    },
  };
}

function serializeDonationSolarSystem(node) {
  if (!node?.key || !node?.label) return null;
  const solarSystemKey = normalizeDonationKey(node.key, FALLBACK_DONATION_SOLAR_SYSTEM.solarSystemKey);

  return {
    label: node.label,
    anchorSlug: FALLBACK_DONATION_ANCHOR.anchorSlug,
    solarSystemKey,
    route: createDonationRouteMetadata(node),
    category: node.kind || 'solar',
    metadata: {
      source: 'world-layout',
      priority: node.priority ?? null,
      region: node.region || 'global',
      tags: Array.isArray(node.tags) ? [...node.tags] : [],
    },
  };
}

function dedupeByKey(options, keyName) {
  const seen = new Set();
  return options.filter((option) => {
    const key = option?.[keyName];
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function withRequiredFallback(options, fallback, keyName) {
  const normalized = dedupeByKey(options.filter(Boolean), keyName);
  if (!normalized.some((option) => option[keyName] === fallback[keyName])) {
    return [fallback, ...normalized];
  }
  return normalized;
}

export function getDonationRouteOptions({ nodes = WORLD_LAYOUT, servers = PRIMARY_SERVER_ROUTES } = {}) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeServers = Array.isArray(servers) ? servers : [];

  const blackholeAnchors = withRequiredFallback(
    safeNodes
      .filter((node) => node?.kind === 'blackhole' && !node.generated)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .map((node) => serializeDonationAnchor(node, { servers: safeServers })),
    FALLBACK_DONATION_ANCHOR,
    'anchorSlug'
  );

  const solarSystems = withRequiredFallback(
    safeNodes
      .filter((node) => node?.kind === 'solar')
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .map(serializeDonationSolarSystem),
    FALLBACK_DONATION_SOLAR_SYSTEM,
    'solarSystemKey'
  );

  return {
    anchors: [...blackholeAnchors, ...solarSystems],
    blackholeAnchors,
    solarSystems,
  };
}

export function getDonationAnchorSlugs(options = getDonationRouteOptions()) {
  return options.blackholeAnchors.map((anchor) => anchor.anchorSlug);
}

export function getDonationSolarSystemKeys(options = getDonationRouteOptions()) {
  return options.solarSystems.map((system) => system.solarSystemKey);
}
