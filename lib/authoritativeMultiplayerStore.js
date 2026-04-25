import { DEFAULT_PRESENCE_SIGNATURE, normalizeHyperspaceSignature } from '@/lib/simulationConfig';
import { normalizeVector3 } from '@/lib/vector3';
import { randomBytes } from 'crypto';

const ROOM_TTL_MS = 1000 * 60 * 20;
const PLAYER_TIMEOUT_MS = 1000 * 12;
const PROJECTILE_TTL_MS = 2200;
const UPDATE_WINDOW_MS = 450;
const ROOM_NAME = process.env.NEXT_PUBLIC_MULTIPLAYER_ROOM || 'tcentral-main';
const TOKEN_BYTES = 24;
const PROJECTILE_SPEED = 18;

function getStore() {
  if (!globalThis.__TCENTRAL_MP_STORE__) {
    globalThis.__TCENTRAL_MP_STORE__ = {
      rooms: new Map(),
    };
  }
  return globalThis.__TCENTRAL_MP_STORE__;
}

function clampNumber(value, fallback = 0, min = -Infinity, max = Infinity) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function sanitizeVector(input, fallback = [0, 0, 0]) {
  if (!Array.isArray(input) || input.length < 3) return fallback.slice(0, 3);
  return [
    clampNumber(input[0], fallback[0], -160, 160),
    clampNumber(input[1], fallback[1], -120, 120),
    clampNumber(input[2], fallback[2], -160, 160),
  ];
}

function distance(a, b) {
  return Math.sqrt(
    Math.pow((a?.[0] || 0) - (b?.[0] || 0), 2) +
    Math.pow((a?.[1] || 0) - (b?.[1] || 0), 2) +
    Math.pow((a?.[2] || 0) - (b?.[2] || 0), 2)
  );
}

function isPlaceholderSnapshot(snapshot = {}) {
  if (!snapshot || typeof snapshot !== 'object') return true;
  const position = Array.isArray(snapshot.position) ? sanitizeVector(snapshot.position, [0, 0, 0]) : null;
  const velocity = Array.isArray(snapshot.velocity) ? sanitizeVector(snapshot.velocity, [0, 0, 0]) : null;
  const speed = clampNumber(snapshot.speed, 0, 0, 500);
  const nearest = typeof snapshot.nearest === 'string' ? snapshot.nearest.trim() : '';
  const quantumSignature = typeof snapshot.quantumSignature === 'string' ? snapshot.quantumSignature.trim() : '';

  const hasOriginPosition = Boolean(position) && position.every((value) => Math.abs(value) < 0.0001);
  const hasZeroVelocity = Boolean(velocity) && velocity.every((value) => Math.abs(value) < 0.0001);
  const hasRealTelemetryHint = speed > 0.01 || nearest.length > 0 || quantumSignature.length > 0;

  return hasOriginPosition && hasZeroVelocity && !hasRealTelemetryHint;
}

function getRoom(roomName = ROOM_NAME) {
  const store = getStore();
  const key = roomName || ROOM_NAME;
  if (!store.rooms.has(key)) {
    store.rooms.set(key, {
      key,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tick: 0,
      players: new Map(),
      projectiles: [],
      world: {
        contestedNodes: [],
        combatHeat: 0,
        anomalyPhase: 0,
      },
      simulationSeed: key,
      gravitySources: buildGravitySourcesFromSeed(key),
    });
  }
  return store.rooms.get(key);
}

function createToken() {
  return `mp_${randomBytes(TOKEN_BYTES).toString('base64url')}`;
}

function pruneRoom(room) {
  const now = Date.now();
  for (const [id, player] of room.players.entries()) {
    if (!player || now - player.updatedAt > PLAYER_TIMEOUT_MS) {
      room.players.delete(id);
    }
  }
  room.projectiles = room.projectiles.filter((shot) => now - shot.createdAt <= PROJECTILE_TTL_MS);
}

function stepProjectiles(room) {
  const now = Date.now();
  room.projectiles = room.projectiles.map((shot) => {
    const elapsed = Math.min((now - shot.createdAt) / 1000, PROJECTILE_TTL_MS / 1000);
    return {
      ...shot,
      position: [
        Number((shot.origin[0] + shot.velocity[0] * elapsed).toFixed(2)),
        Number((shot.origin[1] + shot.velocity[1] * elapsed).toFixed(2)),
        Number((shot.origin[2] + shot.velocity[2] * elapsed).toFixed(2)),
      ],
    };
  }).filter((shot) => now - shot.createdAt <= PROJECTILE_TTL_MS);
}

function buildWorldState(room) {
  const players = [...room.players.values()];
  const nodeBuckets = new Map();
  players.forEach((player) => {
    if (!player.nearest) return;
    const bucket = nodeBuckets.get(player.nearest) || { key: player.nearest, count: 0, combatants: 0 };
    bucket.count += 1;
    if (player.combatState?.lastShotAt && Date.now() - player.combatState.lastShotAt < 6000) bucket.combatants += 1;
    nodeBuckets.set(player.nearest, bucket);
  });

  const contestedNodes = [...nodeBuckets.values()]
    .filter((bucket) => bucket.count >= 2)
    .sort((a, b) => (b.combatants + b.count) - (a.combatants + a.count))
    .slice(0, 4)
    .map((bucket) => ({
      key: bucket.key,
      pressure: bucket.count,
      combatants: bucket.combatants,
    }));

  const combatHeat = Math.min(100, Math.round((room.projectiles.length * 8) + contestedNodes.reduce((sum, node) => sum + node.combatants * 6, 0)));
  const anomalyPhase = Number((((Date.now() / 1000) % 60) / 60).toFixed(2));
  room.world = { contestedNodes, combatHeat, anomalyPhase };
}

function sanitizePlayerForClient(player) {
  return {
    id: player.id,
    displayName: player.displayName,
    avatar: player.avatar || null,
    identityKind: player.identityKind,
    authenticated: Boolean(player.authenticated),
    nearest: player.nearest || null,
    speed: player.speed || 0,
    quantumSignature: normalizeHyperspaceSignature(player.quantumSignature, DEFAULT_PRESENCE_SIGNATURE),
    position: player.position,
    velocity: player.velocity,
    direction: player.direction,
    health: player.health,
    shield: player.shield,
    score: player.score,
    combatState: player.combatState,
    updatedAt: new Date(player.updatedAt).toISOString(),
    frameIndex: Number(player.frameIndex || 0),
    simulationSeed: player.simulationSeed || null,
  };
}

export function joinAuthoritativeRoom({ roomName = ROOM_NAME, identity = {}, steamUser = null } = {}) {
  const room = getRoom(roomName);
  pruneRoom(room);
  room.tick += 1;
  room.updatedAt = Date.now();
  const resolvedIdentityKind = identity.identityKind || identity.kind || 'guest';
  const resolvedAuthenticated = Boolean(identity.authenticated);
  const id = String(identity.id || `guest-${Date.now().toString(36)}`);
  const existing = room.players.get(id);
  const token = existing?.token || createToken();
  const player = existing || {
    id,
    token,
    displayName: identity.displayName || steamUser?.personaname || 'Pilot',
    avatar: steamUser?.avatar || null,
    identityKind: resolvedIdentityKind,
    authenticated: resolvedAuthenticated,
    joinedAt: Date.now(),
    updatedAt: Date.now(),
    position: [0, 0, 18],
    velocity: [0, 0, 0],
    direction: [0, 0, -1],
    nearest: 'deep_blackhole',
    speed: 0,
    quantumSignature: DEFAULT_PRESENCE_SIGNATURE,
    health: 100,
    shield: 100,
    score: 0,
    combatState: { firing: false, lastShotAt: 0 },
    frameIndex: 0,
    simulationSeed: room.simulationSeed,
  };
  room.players.set(id, player);
  buildWorldState(room);
  return {
    ok: true,
    room: room.key,
    token,
    player: sanitizePlayerForClient(player),
    server: { authoritative: true, tick: room.tick },
  };
}

export function updateAuthoritativePlayer({ roomName = ROOM_NAME, id, token, snapshot = {} } = {}) {
  const room = getRoom(roomName);
  pruneRoom(room);
  const player = room.players.get(String(id || ''));
  if (!player || player.token !== token) {
    return { ok: false, status: 401, error: 'PLAYER_SESSION_INVALID' };
  }
  if (isPlaceholderSnapshot(snapshot) && (player.speed > 0.01 || player.nearest || player.quantumSignature)) {
    return { ok: false, status: 422, error: 'PLACEHOLDER_SNAPSHOT_REJECTED' };
  }

  const now = Date.now();
  const incomingDirection = sanitizeVector(snapshot.direction || [0, 0, -1], player.direction);
  const controlVector = sanitizeVector(snapshot.controlVector || [0, 0, 0], [0, 0, 0]).map((value) => Number(value.toFixed(4)));
  const elapsed = Math.max(0.02, Math.min((now - player.updatedAt) / 1000, UPDATE_WINDOW_MS / 1000));
  const dt = clampNumber(snapshot.dt, elapsed, 1 / 120, UPDATE_WINDOW_MS / 1000);
  const stepped = stepFrame({
    position: player.position,
    velocity: player.velocity,
    controlVector,
    dt,
    worldSeed: room.simulationSeed,
    gravitySources: room.gravitySources,
    profile: 'multiplayer',
  });

  player.position = sanitizeVector(stepped.position, player.position).map((value) => Number(value.toFixed(3)));
  const steppedVelocity = sanitizeVector(stepped.velocity, player.velocity);
  player.velocity = steppedVelocity.map((value) => Number(value.toFixed(3)));
  const computedSpeed = clampNumber(Math.hypot(...steppedVelocity), player.speed, 0, 500);
  player.direction = sanitizeVector(incomingDirection, player.direction).map((value) => Number(value.toFixed(2)));
  player.nearest = snapshot.nearest || player.nearest || null;
  player.speed = computedSpeed;
  player.quantumSignature = normalizeHyperspaceSignature(snapshot.quantumSignature || player.quantumSignature, DEFAULT_PRESENCE_SIGNATURE);
  player.updatedAt = now;
  player.frameIndex = Number.isFinite(Number(snapshot.frameIndex)) ? Number(snapshot.frameIndex) : (Number(player.frameIndex || 0) + 1);
  player.simulationSeed = room.simulationSeed;
  player.combatState = {
    firing: Boolean(snapshot.firing),
    lastShotAt: player.combatState?.lastShotAt || 0,
  };

  stepProjectiles(room);
  buildWorldState(room);
  room.tick += 1;
  room.updatedAt = now;

  return {
    ok: true,
    room: room.key,
    tick: room.tick,
    state: serializeRoom(room, id),
  };
}

export function applyAuthoritativeAction({ roomName = ROOM_NAME, id, token, action = {} } = {}) {
  const room = getRoom(roomName);
  pruneRoom(room);
  const player = room.players.get(String(id || ''));
  if (!player || player.token !== token) {
    return { ok: false, status: 401, error: 'PLAYER_SESSION_INVALID' };
  }

  if (action.type === 'fire') {
    const fallbackDirection = sanitizeVector(player.direction || [0, 0, -1], [0, 0, -1]);
    const normalizedDirection = normalizeVector3(
      sanitizeVector(action.velocity || player.direction || [0, 0, -1], fallbackDirection),
      fallbackDirection,
    );
    const velocity = normalizedDirection.map((value) => Number((value * PROJECTILE_SPEED).toFixed(3)));
    const projectile = {
      id: `shot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      ownerId: player.id,
      createdAt: Date.now(),
      origin: player.position.slice(0, 3),
      velocity,
      position: player.position.slice(0, 3),
      color: action.color || '#9fe8ff',
    };
    room.projectiles.push(projectile);
    player.combatState = { firing: true, lastShotAt: Date.now() };
    player.score = clampNumber(player.score, 0, 0, 999999) + 1;
  }

  stepProjectiles(room);
  buildWorldState(room);
  room.tick += 1;
  room.updatedAt = Date.now();

  return {
    ok: true,
    room: room.key,
    tick: room.tick,
    state: serializeRoom(room, id),
  };
}

export function getAuthoritativeState({ roomName = ROOM_NAME, id, token } = {}) {
  const room = getRoom(roomName);
  pruneRoom(room);
  const player = room.players.get(String(id || ''));
  if (!player || player.token !== token) {
    return { ok: false, status: 401, error: 'PLAYER_SESSION_INVALID' };
  }
  stepProjectiles(room);
  buildWorldState(room);
  room.tick += 1;
  room.updatedAt = Date.now();
  return {
    ok: true,
    room: room.key,
    tick: room.tick,
    state: serializeRoom(room, id),
  };
}

export function serializeRoom(room, selfId = null) {
  return {
    authoritative: true,
    room: room.key,
    tick: room.tick,
    playerCount: room.players.size,
    selfId,
    players: [...room.players.values()].map(sanitizePlayerForClient),
    projectiles: room.projectiles.map((shot) => ({
      id: shot.id,
      ownerId: shot.ownerId,
      position: shot.position,
      color: shot.color,
      createdAt: new Date(shot.createdAt).toISOString(),
    })),
    world: room.world,
    simulation: {
      seed: room.simulationSeed,
      frameIndex: room.tick,
    },
  };
}

export function pruneAuthoritativeRooms() {
  const store = getStore();
  const now = Date.now();
  for (const [key, room] of store.rooms.entries()) {
    pruneRoom(room);
    if (room.players.size === 0 && now - room.updatedAt > ROOM_TTL_MS) {
      store.rooms.delete(key);
    }
  }
}
