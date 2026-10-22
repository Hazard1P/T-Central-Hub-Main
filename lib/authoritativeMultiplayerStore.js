import { PLAYER_LEASE_MS, multiplayerCapacity, roomPopulation } from './multiplayerCapacity.js';
import { WORLD_LIMIT, MAX_FLIGHT_SPEED } from './universeSpace.js';
import { buildGravitySourcesFromSeed } from './simCore/stepFrame.js';
import { DEFAULT_PRESENCE_SIGNATURE, normalizeHyperspaceSignature } from './simulationConfig.js';
import { normalizeVector3 } from './vector3.js';
import { randomBytes } from 'crypto';
import { advanceFlightBatch } from './simCore/flightBatch.js';
import { getPilotSpawn } from './exploration.js';
import { normalizedAim, PULSE_INTERVAL_MS, PULSE_SPEED } from './shipWeapons.js';

const ROOM_TTL_MS = 1000 * 60 * 20;
const PLAYER_TIMEOUT_MS = PLAYER_LEASE_MS;
const PROJECTILE_TTL_MS = 2200;
const UPDATE_WINDOW_MS = 450;
const ROOM_NAME = process.env.NEXT_PUBLIC_MULTIPLAYER_ROOM || 'tcentral-main';
const TOKEN_BYTES = 24;
const PROJECTILE_SPEED = PULSE_SPEED;

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
    clampNumber(input[0], fallback[0], -WORLD_LIMIT, WORLD_LIMIT),
    clampNumber(input[1], fallback[1], -WORLD_LIMIT, WORLD_LIMIT),
    clampNumber(input[2], fallback[2], -WORLD_LIMIT, WORLD_LIMIT),
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
  const speed = clampNumber(snapshot.speed, 0, 0, MAX_FLIGHT_SPEED);
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
      readCount: 0,
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
  room.updatedAt = Date.now();
  const resolvedIdentityKind = identity.identityKind || identity.kind || 'guest';
  const resolvedAuthenticated = Boolean(identity.authenticated);
  const id = String(identity.id || `guest-${Date.now().toString(36)}`);
  const existing = room.players.get(id);
  const population = roomPopulation(room.players.size);
  if (!existing && population.full) return { ok: false, status: 409, error: 'ROOM_FULL', room: room.key, population, retryAfter: 5 };
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
    position: getPilotSpawn(id),
    velocity: [0, 0, 0],
    direction: [0, 0, -1],
    nearest: 'solar-earth',
    speed: 0,
    quantumSignature: DEFAULT_PRESENCE_SIGNATURE,
    health: 100,
    shield: 100,
    score: 0,
    combatState: { firing: false, lastShotAt: 0 },
    frameIndex: 0,
    simulationSeed: room.simulationSeed,
  };
  player.updatedAt = Date.now();
  room.players.set(id, player);
  buildWorldState(room);
  return {
    ok: true,
    room: room.key,
    token,
    player: sanitizePlayerForClient(player),
    population: roomPopulation(room.players.size),
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
  const elapsed = Math.max(0, Math.min((now - player.updatedAt) / 1000, UPDATE_WINDOW_MS / 1000));
  const stepped = advanceFlightBatch({
    position: player.position,
    velocity: player.velocity,
    snapshot: { ...snapshot, controlVector },
    frameIndex: player.frameIndex || 0,
    elapsed,
    worldSeed: room.simulationSeed,
    gravitySources: room.gravitySources,
  });

  player.position = sanitizeVector(stepped.position, player.position).map((value) => Number(value.toFixed(3)));
  const steppedVelocity = sanitizeVector(stepped.velocity, player.velocity);
  player.velocity = steppedVelocity.map((value) => Number(value.toFixed(3)));
  const computedSpeed = clampNumber(Math.hypot(...steppedVelocity), player.speed, 0, MAX_FLIGHT_SPEED);
  player.direction = sanitizeVector(incomingDirection, player.direction).map((value) => Number(value.toFixed(2)));
  player.nearest = snapshot.nearest || player.nearest || null;
  player.speed = computedSpeed;
  player.quantumSignature = normalizeHyperspaceSignature(snapshot.quantumSignature || player.quantumSignature, DEFAULT_PRESENCE_SIGNATURE);
  player.updatedAt = now;
  player.frameIndex = stepped.frameIndex;
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
    if (Date.now() - Number(player.combatState?.lastShotAt || 0) < PULSE_INTERVAL_MS) return { ok: false, status: 429, error: 'WEAPON_COOLDOWN' };
    const normalizedDirection = normalizedAim(action.direction || action.velocity || player.direction);
    if (!normalizedDirection) return { ok: false, status: 400, error: 'INVALID_FIRE_DIRECTION' };
    const velocity = normalizedDirection.map((value, axis) => Number((value * PROJECTILE_SPEED + player.velocity[axis]).toFixed(3)));
    const projectile = {
      id: `shot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      ownerId: player.id,
      createdAt: Date.now(),
      origin: player.position.slice(0, 3),
      velocity,
      direction: normalizedDirection,
      position: player.position.slice(0, 3),
      color: '#9fe8ff',
    };
    room.projectiles.push(projectile);
    room.projectiles = room.projectiles.slice(-192);
    player.combatState = { firing: true, lastShotAt: Date.now() };
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
  room.readCount = Number(room.readCount || 0) + 1;
  room.updatedAt = Date.now();
  return {
    ok: true,
    room: room.key,
    tick: room.tick,
    state: serializeRoom(room, id),
  };
}

export function disconnectAuthoritativePlayer({ roomName = ROOM_NAME, id, token } = {}) {
  const room = getStore().rooms.get(roomName);
  const player = room?.players.get(String(id || ''));
  if (!player || player.token !== token) return { ok: false, status: 401, error: 'PLAYER_SESSION_INVALID' };
  room.players.delete(player.id);
  room.projectiles = room.projectiles.filter((shot) => shot.ownerId !== player.id);
  buildWorldState(room);
  room.tick += 1;
  room.updatedAt = Date.now();
  return { ok: true };
}

export function serializeRoom(room, selfId = null) {
  return {
    authoritative: true,
    room: room.key,
    tick: room.tick,
    playerCount: room.players.size,
    population: roomPopulation(room.players.size),
    selfId,
    players: [...room.players.values()].map(sanitizePlayerForClient),
    projectiles: room.projectiles.map((shot) => ({
      id: shot.id,
      ownerId: shot.ownerId,
      position: shot.position,
      velocity: shot.velocity,
      direction: shot.direction,
      color: shot.color,
      createdAt: new Date(shot.createdAt).toISOString(),
    })),
    world: room.world,
    simulation: {
      seed: room.simulationSeed,
      // Keep simulation frame index bound only to simulation/mutation tick updates.
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

export function getAuthoritativeLobby(roomName = ROOM_NAME) {
  const room = getStore().rooms.get(roomName);
  if (room) pruneRoom(room);
  return { ok: true, room: roomName, durable: false, population: roomPopulation(room?.players.size || 0) };
}
