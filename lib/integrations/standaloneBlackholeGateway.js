import { buildUniverseGraph } from '@/lib/universeEngine';
import { PHYSICS_CONSTANTS, createGravitySources, sampleGravityField } from '@/lib/physicsEngine';

const EVENT_LOG_LIMIT = 20;

export const MAP_GATEWAY_REJECTION = {
  MAP_NOT_READY: 'MAP_NOT_READY',
  INVALID_VECTOR: 'INVALID_VECTOR',
  COORDINATE_OUT_OF_RANGE: 'COORDINATE_OUT_OF_RANGE',
  PHYSICS_CONSTRAINT_FAILED: 'PHYSICS_CONSTRAINT_FAILED',
  UNSUPPORTED_PAYLOAD: 'UNSUPPORTED_PAYLOAD',
  TRANSFORM_FAILED: 'TRANSFORM_FAILED',
};

export const CANONICAL_MAP_ASSET = {
  package: 'public',
  assetPath: '/cosmic-map-reference.jpg',
  fallbackAssetPath: '/cosmic-map.jpg',
  coordinateSystem: {
    basis: 'right-handed',
    axis: {
      x: 'left-to-right lateral',
      y: 'down-to-up elevation',
      z: 'near-to-far depth',
    },
    originBehavior: 'runtime origin is centered on Deep Space Blackhole anchor (deep_blackhole).',
    mapSpaceOriginBehavior: 'normalized map origin (0,0) is top-left in UI overlays; simulation origin is anchor-relative.',
    unitScale: '1 simulation unit = 1 world layout unit.',
  },
};

const gatewayState = {
  startedAt: new Date().toISOString(),
  readinessChecks: [],
  recentEvents: [],
  totals: {
    accepted: 0,
    rejected: 0,
  },
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeVector(value, fallback = [0, 0, 0]) {
  if (!Array.isArray(value) || value.length < 3) return fallback.slice(0, 3);
  return [toNumber(value[0], fallback[0]), toNumber(value[1], fallback[1]), toNumber(value[2], fallback[2])];
}

function inBounds(vector = [0, 0, 0]) {
  return vector[0] >= PHYSICS_CONSTANTS.worldBounds.x[0]
    && vector[0] <= PHYSICS_CONSTANTS.worldBounds.x[1]
    && vector[1] >= PHYSICS_CONSTANTS.worldBounds.y[0]
    && vector[1] <= PHYSICS_CONSTANTS.worldBounds.y[1]
    && vector[2] >= PHYSICS_CONSTANTS.worldBounds.z[0]
    && vector[2] <= PHYSICS_CONSTANTS.worldBounds.z[1];
}

function makeEvent(event = {}) {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };
}

function pushEvent(event) {
  gatewayState.recentEvents.unshift(makeEvent(event));
  gatewayState.recentEvents = gatewayState.recentEvents.slice(0, EVENT_LOG_LIMIT);
}

export function getCanonicalMapSpec() {
  const graph = buildUniverseGraph();
  const deep = graph.nodes.find((node) => node.key === 'deep_blackhole');
  const standalone = graph.nodes.find((node) => node.key === 'standalone_blackhole');

  return {
    ...CANONICAL_MAP_ASSET,
    anchors: {
      deepBlackhole: deep ? { key: deep.key, position: deep.position } : null,
      standaloneBlackhole: standalone ? { key: standalone.key, position: standalone.position } : null,
    },
    physicsLayer: {
      worldBounds: PHYSICS_CONSTANTS.worldBounds,
      maxSpeed: PHYSICS_CONSTANTS.maxSpeed,
      gravitationalConstant: PHYSICS_CONSTANTS.G,
    },
  };
}

function resolveAnchors() {
  const graph = buildUniverseGraph();
  const deep = graph.nodes.find((node) => node.key === 'deep_blackhole');
  const standalone = graph.nodes.find((node) => node.key === 'standalone_blackhole');
  const gravitySources = createGravitySources(graph.nodes.filter((node) => ['blackhole', 'dyson', 'solar'].includes(node.kind)));
  return { deep, standalone, gravitySources };
}

export function evaluateGatewayReadiness() {
  const { deep, standalone, gravitySources } = resolveAnchors();
  const checks = [
    {
      key: 'canonical-map-asset',
      passed: Boolean(CANONICAL_MAP_ASSET.assetPath),
      detail: CANONICAL_MAP_ASSET.assetPath,
    },
    {
      key: 'deep-anchor',
      passed: Boolean(deep?.position?.length === 3),
      detail: deep?.position || null,
    },
    {
      key: 'standalone-anchor',
      passed: Boolean(standalone?.position?.length === 3),
      detail: standalone?.position || null,
    },
    {
      key: 'physics-layer',
      passed: Boolean(gravitySources.length > 0),
      detail: `gravitySources=${gravitySources.length}`,
    },
  ];

  gatewayState.readinessChecks = checks;
  return {
    ready: checks.every((check) => check.passed),
    checks,
  };
}

export function mapStandaloneVector(vector, mode = 'entry') {
  const { deep, standalone } = resolveAnchors();
  if (!deep || !standalone) {
    return { ok: false, code: MAP_GATEWAY_REJECTION.MAP_NOT_READY };
  }

  const sourceVector = normalizeVector(vector, [0, 0, 0]);
  const relative = mode === 'exit'
    ? [sourceVector[0] - deep.position[0], sourceVector[1] - deep.position[1], sourceVector[2] - deep.position[2]]
    : [sourceVector[0] - standalone.position[0], sourceVector[1] - standalone.position[1], sourceVector[2] - standalone.position[2]];

  const mapped = mode === 'exit'
    ? [
        Number((standalone.position[0] + relative[0]).toFixed(4)),
        Number((standalone.position[1] + relative[1]).toFixed(4)),
        Number((standalone.position[2] + relative[2]).toFixed(4)),
      ]
    : [
        Number((deep.position[0] + relative[0]).toFixed(4)),
        Number((deep.position[1] + relative[1]).toFixed(4)),
        Number((deep.position[2] + relative[2]).toFixed(4)),
      ];

  if (!inBounds(mapped)) {
    return { ok: false, code: MAP_GATEWAY_REJECTION.COORDINATE_OUT_OF_RANGE, mapped };
  }

  return {
    ok: true,
    mode,
    sourceVector,
    mapped,
    basis: {
      sourceAnchor: mode === 'exit' ? deep.key : standalone.key,
      targetAnchor: mode === 'exit' ? standalone.key : deep.key,
    },
  };
}

export function classifyMigrationPayload(payload = {}) {
  if (payload?.type && ['entity', 'inventory', 'mission_state', 'world_state'].includes(payload.type)) {
    return payload.type;
  }

  if (payload?.entityId || payload?.position || payload?.velocity) return 'entity';
  if (Array.isArray(payload?.items)) return 'inventory';
  if (payload?.missionId || Array.isArray(payload?.waypoints)) return 'mission_state';
  if (payload?.worldTick || payload?.anchorStates) return 'world_state';
  return 'unknown';
}

function validatePhysicsAt(vector, gravitySources = []) {
  if (!inBounds(vector)) {
    return { ok: false, code: MAP_GATEWAY_REJECTION.COORDINATE_OUT_OF_RANGE, detail: 'outside world bounds' };
  }
  const sample = sampleGravityField({ position: vector, sources: gravitySources });
  if (sample?.horizon?.insideHorizon) {
    return { ok: false, code: MAP_GATEWAY_REJECTION.PHYSICS_CONSTRAINT_FAILED, detail: 'inside event horizon' };
  }
  if ((sample?.magnitude || 0) > 5000) {
    return { ok: false, code: MAP_GATEWAY_REJECTION.PHYSICS_CONSTRAINT_FAILED, detail: 'gravity magnitude overflow' };
  }
  return { ok: true, sample };
}

export function transformMigrationPayload({ payloadType, payload, entryMap, exitMap }) {
  switch (payloadType) {
    case 'entity':
      return {
        ok: true,
        transformed: {
          ...payload,
          migrationType: 'entity',
          position: entryMap?.mapped || payload.position || [0, 0, 0],
          exitPosition: exitMap?.mapped || null,
          velocity: normalizeVector(payload.velocity, [0, 0, 0]),
        },
      };
    case 'inventory':
      return {
        ok: true,
        transformed: {
          ...payload,
          migrationType: 'inventory',
          settlementAnchor: entryMap?.basis?.targetAnchor || 'deep_blackhole',
          transferMode: 'gateway_manifest_v1',
        },
      };
    case 'mission_state':
      return {
        ok: true,
        transformed: {
          ...payload,
          migrationType: 'mission_state',
          waypoints: Array.isArray(payload.waypoints)
            ? payload.waypoints.map((waypoint) => ({
                ...waypoint,
                mappedPosition: mapStandaloneVector(waypoint.position || [0, 0, 0], 'entry')?.mapped || [0, 0, 0],
              }))
            : [],
        },
      };
    case 'world_state':
      return {
        ok: true,
        transformed: {
          ...payload,
          migrationType: 'world_state',
          mappedAnchors: {
            entry: entryMap?.mapped || null,
            exit: exitMap?.mapped || null,
          },
        },
      };
    default:
      return { ok: false, code: MAP_GATEWAY_REJECTION.UNSUPPORTED_PAYLOAD };
  }
}

export function migrateIntoGame({ payload = {}, payloadType, entryVector, exitVector, requestedBy = 'system' } = {}) {
  const readiness = evaluateGatewayReadiness();
  if (!readiness.ready) {
    gatewayState.totals.rejected += 1;
    pushEvent({ status: 'rejected', code: MAP_GATEWAY_REJECTION.MAP_NOT_READY, requestedBy, payloadType: payloadType || classifyMigrationPayload(payload) });
    return { ok: false, code: MAP_GATEWAY_REJECTION.MAP_NOT_READY, readiness };
  }

  const kind = payloadType || classifyMigrationPayload(payload);
  const entry = mapStandaloneVector(entryVector || payload.position || [0, 0, 0], 'entry');
  if (!entry.ok) {
    gatewayState.totals.rejected += 1;
    pushEvent({ status: 'rejected', code: entry.code || MAP_GATEWAY_REJECTION.INVALID_VECTOR, requestedBy, payloadType: kind });
    return { ok: false, code: entry.code || MAP_GATEWAY_REJECTION.INVALID_VECTOR, entry };
  }

  const exit = exitVector ? mapStandaloneVector(exitVector, 'exit') : { ok: true, mapped: null, basis: entry.basis };
  if (!exit.ok) {
    gatewayState.totals.rejected += 1;
    pushEvent({ status: 'rejected', code: exit.code || MAP_GATEWAY_REJECTION.INVALID_VECTOR, requestedBy, payloadType: kind });
    return { ok: false, code: exit.code || MAP_GATEWAY_REJECTION.INVALID_VECTOR, exit };
  }

  const { gravitySources } = resolveAnchors();
  const physicsCheck = validatePhysicsAt(entry.mapped, gravitySources);
  if (!physicsCheck.ok) {
    gatewayState.totals.rejected += 1;
    pushEvent({ status: 'rejected', code: physicsCheck.code, detail: physicsCheck.detail, requestedBy, payloadType: kind });
    return { ok: false, code: physicsCheck.code, detail: physicsCheck.detail, mapped: entry.mapped };
  }

  const transformed = transformMigrationPayload({ payloadType: kind, payload, entryMap: entry, exitMap: exit });
  if (!transformed.ok) {
    gatewayState.totals.rejected += 1;
    pushEvent({ status: 'rejected', code: transformed.code || MAP_GATEWAY_REJECTION.TRANSFORM_FAILED, requestedBy, payloadType: kind });
    return { ok: false, code: transformed.code || MAP_GATEWAY_REJECTION.TRANSFORM_FAILED };
  }

  gatewayState.totals.accepted += 1;
  pushEvent({ status: 'accepted', code: 'OK', requestedBy, payloadType: kind, mappedEntry: entry.mapped, mappedExit: exit.mapped });

  return {
    ok: true,
    payloadType: kind,
    transformed: transformed.transformed,
    mapping: { entry, exit },
    physics: physicsCheck.sample,
  };
}

export function getGatewayStatus() {
  const readiness = evaluateGatewayReadiness();
  return {
    ok: true,
    gateway: {
      name: 'standalone-blackhole-map-gateway',
      version: '1.0.0',
      startedAt: gatewayState.startedAt,
      ready: readiness.ready,
      checks: readiness.checks,
      canonicalMap: getCanonicalMapSpec(),
      migrationProtocol: {
        payloadClassification: ['entity', 'inventory', 'mission_state', 'world_state'],
        transformRules: {
          entity: 'entry/exit vectors are remapped into deep_blackhole frame with velocity preserved.',
          inventory: 'inventory items are tagged with settlementAnchor and transferMode gateway manifest.',
          mission_state: 'waypoints are remapped via entry vector translation per waypoint.',
          world_state: 'anchor state is persisted as mapped entry/exit anchor vectors.',
        },
        validationStates: ['ready', 'mapping_verified', 'physics_verified', 'transformed'],
        rejectionStates: Object.values(MAP_GATEWAY_REJECTION),
      },
      totals: gatewayState.totals,
      recentEvents: gatewayState.recentEvents,
    },
  };
}
