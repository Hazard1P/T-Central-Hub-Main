import { PRIMARY_SERVER_ROUTES } from './serverData.js';

export const ROUTE_STATUS = Object.freeze({
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  OFFLINE: 'offline',
});

const MODE_SINGLE = 'single_player';
const MODE_MULTI = 'multi_player';

function normalizeMode(mode = MODE_MULTI) {
  const value = String(mode || MODE_MULTI).trim().toLowerCase();
  if (value === 'single' || value === 'singleplayer' || value === 'single_player' || value === 'private') return MODE_SINGLE;
  if (value === 'multi' || value === 'multiplayer' || value === 'multi_player' || value === 'hub') return MODE_MULTI;
  return MODE_MULTI;
}

function normalizeModeSupport(modeSupport) {
  if (Array.isArray(modeSupport) && modeSupport.length) {
    return Array.from(new Set(modeSupport.map((mode) => normalizeMode(mode))));
  }
  return [MODE_MULTI];
}

function inferBlackholeClass(node = {}) {
  if (node.associatedServer) return 'server-linked';
  if (node.generated && node.key?.startsWith('perimeter_blackhole')) return 'perimeter';
  if (node.key === 'deep_blackhole') return 'deep-space';
  if (node.key === 'standalone_blackhole') return 'standalone';
  return 'general';
}

function isHealthy(instance = {}) {
  return instance?.healthy !== false;
}

export function createServerInstanceCatalog(regionalHealth = {}) {
  const shared = PRIMARY_SERVER_ROUTES.reduce((acc, server) => {
    acc[server.id] = {
      id: server.id,
      authority: 'session-authoritative',
      region: regionalHealth?.[server.id]?.region || 'global',
      healthy: regionalHealth?.[server.id]?.healthy ?? true,
      route: server.href,
      statusKey: server.statusKey,
      multiplayerOnly: true,
    };
    return acc;
  }, {});

  return shared;
}

export function buildBlackholeBindingRegistry(nodes = []) {
  const registry = new Map();
  const activeByClass = new Map();
  const activeByInstance = new Map();

  nodes
    .filter((node) => node.kind === 'blackhole')
    .forEach((node) => {
      const blackholeClass = inferBlackholeClass(node);
      const modeSupport = normalizeModeSupport(node.mode_support);
      const region = node.region || 'global';
      const routeRecord = {
        blackhole_id: node.key,
        blackhole_class: blackholeClass,
        target_server_id: node.target_server_id || null,
        fallback_server_id: node.fallback_server_id || null,
        mode_support: modeSupport,
        region,
      };

      // Enforce exactly one active server route per class/instance. First bind wins.
      if (routeRecord.target_server_id) {
        if (!activeByClass.has(blackholeClass)) {
          activeByClass.set(blackholeClass, routeRecord.target_server_id);
        } else {
          routeRecord.target_server_id = activeByClass.get(blackholeClass);
        }

        if (!activeByInstance.has(routeRecord.target_server_id)) {
          activeByInstance.set(routeRecord.target_server_id, routeRecord.blackhole_id);
        } else if (activeByInstance.get(routeRecord.target_server_id) !== routeRecord.blackhole_id) {
          routeRecord.target_server_id = null;
        }
      }

      registry.set(node.key, routeRecord);
    });

  return registry;
}

function getDefaultPrivateInstanceId(blackholeId) {
  return `private-local:${blackholeId}`;
}

function selectCandidateServers(binding, mode, serverInstances) {
  if (mode === MODE_SINGLE) {
    return [getDefaultPrivateInstanceId(binding.blackhole_id)];
  }

  const list = [];
  if (binding.target_server_id) list.push(binding.target_server_id);
  if (binding.fallback_server_id) list.push(binding.fallback_server_id);
  return list;
}

function getPrivateInstance(instanceId, binding) {
  return {
    id: instanceId,
    authority: 'local-authoritative',
    healthy: true,
    region: binding.region || 'local',
    privateOnly: true,
  };
}

export function resolveBlackholeRouteAtJumpCommit({
  blackholeId,
  mode,
  registry,
  serverInstances,
  previousCommit = null,
  committedAt = Date.now(),
} = {}) {
  const safeMode = normalizeMode(mode);
  const binding = registry?.get(blackholeId);
  if (!binding) {
    return {
      ok: false,
      blackholeId,
      status: ROUTE_STATUS.OFFLINE,
      reason: 'binding_not_found',
      destination: null,
      committedAt,
    };
  }

  if (!binding.mode_support.includes(safeMode)) {
    return {
      ok: false,
      blackholeId,
      status: ROUTE_STATUS.OFFLINE,
      reason: 'mode_not_supported',
      destination: null,
      committedAt,
    };
  }

  const candidates = selectCandidateServers(binding, safeMode, serverInstances);
  let selected = null;
  let usedFallback = false;

  for (let i = 0; i < candidates.length; i += 1) {
    const id = candidates[i];
    const instance = safeMode === MODE_SINGLE
      ? getPrivateInstance(id, binding)
      : serverInstances[id];
    if (!instance) continue;

    if (safeMode === MODE_MULTI && !['shared-authoritative', 'session-authoritative'].includes(instance.authority)) {
      continue;
    }

    if (safeMode === MODE_SINGLE && !['private-authoritative', 'local-authoritative'].includes(instance.authority)) {
      continue;
    }

    if (isHealthy(instance)) {
      selected = instance;
      usedFallback = i > 0;
      break;
    }
  }

  if (!selected) {
    return {
      ok: false,
      blackholeId,
      status: ROUTE_STATUS.OFFLINE,
      reason: 'no_healthy_route',
      destination: null,
      committedAt,
    };
  }

  const stateHandoff = {
    continuity_key: previousCommit?.stateHandoff?.continuity_key || `${blackholeId}:${safeMode}`,
    previous_destination_id: previousCommit?.destination?.id || null,
    destination_changed: previousCommit?.destination?.id ? previousCommit.destination.id !== selected.id : false,
  };

  return {
    ok: true,
    blackholeId,
    status: usedFallback ? ROUTE_STATUS.DEGRADED : ROUTE_STATUS.HEALTHY,
    destination: selected,
    usedFallback,
    reason: usedFallback ? 'failover' : 'primary',
    committedAt,
    stateHandoff,
  };
}

export function buildBlackholeConnectivityAtlas({ nodes = [], mode = MODE_MULTI, serverHealth = {}, previousCommits = {} } = {}) {
  const registry = buildBlackholeBindingRegistry(nodes);
  const serverInstances = createServerInstanceCatalog(serverHealth);

  const connectivity = {};
  nodes
    .filter((node) => node.kind === 'blackhole')
    .forEach((node) => {
      const commit = resolveBlackholeRouteAtJumpCommit({
        blackholeId: node.key,
        mode,
        registry,
        serverInstances,
        previousCommit: previousCommits?.[node.key] || null,
      });

      connectivity[node.key] = {
        status: commit.status,
        destinationServerId: commit.destination?.id || null,
        usedFallback: Boolean(commit.usedFallback),
        mode: normalizeMode(mode),
      };
    });

  return { connectivity, registry, serverInstances };
}
