import { getSupabaseAdmin, hasSupabaseAdmin } from '@/lib/server/supabaseAdmin';
import { createHash } from 'crypto';
import { validateSimulationSymmetry } from '@/lib/symmetryValidator';

const ROOM_NAME = process.env.NEXT_PUBLIC_MULTIPLAYER_ROOM || 'tcentral-main';
const PLAYER_TIMEOUT_MS = 1000 * 20;
const EVENT_TIMEOUT_MS = 1000 * 10;
const CLEANUP_PLAYER_MS = 1000 * 60 * 10;
const CLEANUP_EVENT_MS = 1000 * 60 * 30;
const MAX_STATE_PLAYERS = Number(process.env.MULTIPLAYER_STATE_MAX_PLAYERS || 120);
const MAX_STATE_EVENTS = Number(process.env.MULTIPLAYER_STATE_MAX_EVENTS || 64);
const SIM_EVENT_RATE_LIMIT_MS = Number(process.env.SIM_EVENT_RATE_LIMIT_MS || 250);
const SIM_EVENT_SAMPLE_RATE_STATE = Number(process.env.SIM_EVENT_SAMPLE_RATE_STATE || 0.15);
const SIM_EVENT_SAMPLE_RATE_ACTION = Number(process.env.SIM_EVENT_SAMPLE_RATE_ACTION || 1);
const SIM_EVENT_QUERY_LIMIT = Number(process.env.SIM_EVENT_QUERY_LIMIT || 200);
const SYMMETRY_MAX_EVENTS = Number(process.env.SYMMETRY_MAX_EVENTS || 500);
const symmetrySessionRateMap = new Map();

function nowIso() {
  return new Date().toISOString();
}

function createToken() {
  return `mp_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function createEventId() {
  return `sim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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

function sanitizeScalar(input, fallback = 0, min = -1e6, max = 1e6) {
  return Number(clampNumber(input, fallback, min, max).toFixed(6));
}

function sanitizeHorizonMetrics(input = {}) {
  const metrics = typeof input === 'object' && input ? input : {};
  return {
    curvature: sanitizeScalar(metrics.curvature, 0, -1e6, 1e6),
    distance: sanitizeScalar(metrics.distance, 0, 0, 1e9),
    anisotropy: sanitizeScalar(metrics.anisotropy, 0, -1e6, 1e6),
  };
}

function sanitizeSpinState(input = {}) {
  const spin = typeof input === 'object' && input ? input : {};
  return {
    axis: sanitizeVector(spin.axis, [0, 1, 0]).map((v) => sanitizeScalar(v, 0, -1, 1)),
    angularVelocity: sanitizeScalar(spin.angularVelocity, 0, -1e4, 1e4),
    phase: sanitizeScalar(spin.phase, 0, -Math.PI * 100, Math.PI * 100),
  };
}

function computeSimulationChecksum(eventPayload) {
  return createHash('sha256').update(JSON.stringify(eventPayload)).digest('hex');
}

function shouldSampleSimulationEvent({ sessionId, sampleRate, now = Date.now() }) {
  if (sampleRate <= 0) return false;
  if (sampleRate < 1 && Math.random() > sampleRate) return false;
  if (!sessionId) return false;
  const last = symmetrySessionRateMap.get(sessionId) || 0;
  if (now - last < SIM_EVENT_RATE_LIMIT_MS) return false;
  symmetrySessionRateMap.set(sessionId, now);
  if (symmetrySessionRateMap.size > 4000) {
    const cutoff = now - (SIM_EVENT_RATE_LIMIT_MS * 20);
    for (const [key, value] of symmetrySessionRateMap.entries()) {
      if (value < cutoff) symmetrySessionRateMap.delete(key);
    }
  }
  return true;
}

async function writeSimulationEvent({
  roomName = ROOM_NAME,
  playerId,
  sessionId,
  frameIndex,
  sampleRate = SIM_EVENT_SAMPLE_RATE_STATE,
  physics = {},
  source = 'state',
} = {}) {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, skipped: true, reason: 'DURABLE_MULTIPLAYER_UNAVAILABLE' };

  const now = Date.now();
  if (!shouldSampleSimulationEvent({ sessionId, sampleRate, now })) {
    return { ok: true, sampledOut: true };
  }

  const physicsPayload = {
    input: {
      position: sanitizeVector(physics?.input?.position, [0, 0, 18]).map((v) => sanitizeScalar(v, 0, -1e6, 1e6)),
      velocity: sanitizeVector(physics?.input?.velocity, [0, 0, 0]).map((v) => sanitizeScalar(v, 0, -1e6, 1e6)),
      gravitySample: sanitizeVector(physics?.input?.gravitySample, [0, 0, 0]).map((v) => sanitizeScalar(v)),
      horizonMetrics: sanitizeHorizonMetrics(physics?.input?.horizonMetrics),
      spinState: sanitizeSpinState(physics?.input?.spinState),
    },
    output: {
      position: sanitizeVector(physics?.output?.position, [0, 0, 18]).map((v) => sanitizeScalar(v, 0, -1e6, 1e6)),
      velocity: sanitizeVector(physics?.output?.velocity, [0, 0, 0]).map((v) => sanitizeScalar(v, 0, -1e6, 1e6)),
      gravitySample: sanitizeVector(physics?.output?.gravitySample, [0, 0, 0]).map((v) => sanitizeScalar(v)),
      horizonMetrics: sanitizeHorizonMetrics(physics?.output?.horizonMetrics),
      spinState: sanitizeSpinState(physics?.output?.spinState),
    },
  };

  const eventPayload = {
    event_id: createEventId(),
    room_name: roomName,
    player_id: String(playerId || ''),
    session_id: String(sessionId || ''),
    event_timestamp: new Date(now).toISOString(),
    frame_index: Number.isFinite(Number(frameIndex)) ? Number(frameIndex) : now,
    source,
    physics_input: physicsPayload.input,
    physics_output: physicsPayload.output,
  };
  const row = { ...eventPayload, event_checksum: computeSimulationChecksum(eventPayload) };
  const { error } = await admin.from('simulation_events').insert(row);
  if (error) return { ok: false, error: error.message };
  return { ok: true, eventId: row.event_id };
}

function sanitizePlayerRow(row = {}) {
  return {
    id: String(row.player_id || row.id || ''),
    displayName: row.display_name || 'Pilot',
    avatar: row.avatar_url || null,
    identityKind: row.identity_kind || 'guest',
    authenticated: Boolean(row.authenticated),
    nearest: row.nearest || null,
    speed: clampNumber(row.speed, 0, 0, 500),
    quantumSignature: row.quantum_signature || 'Q12D-0-0',
    position: sanitizeVector(row.position, [0, 0, 18]),
    velocity: sanitizeVector(row.velocity, [0, 0, 0]),
    direction: sanitizeVector(row.direction, [0, 0, -1]),
    health: clampNumber(row.health, 100, 0, 100),
    shield: clampNumber(row.shield, 100, 0, 100),
    score: clampNumber(row.score, 0, 0, 999999),
    combatState: typeof row.combat_state === 'object' && row.combat_state ? row.combat_state : { firing: false, lastShotAt: 0 },
    updatedAt: row.last_seen || row.updated_at || nowIso(),
  };
}

function sanitizeProjectileRow(row = {}) {
  const payload = typeof row.payload === 'object' && row.payload ? row.payload : {};
  return {
    id: row.id,
    ownerId: row.player_id,
    createdAt: new Date(row.created_at || nowIso()).getTime(),
    origin: sanitizeVector(payload.origin, [0, 0, 0]),
    velocity: sanitizeVector(payload.velocity, [0, 0, -18]),
    position: sanitizeVector(payload.position || payload.origin, [0, 0, 0]),
    color: payload.color || '#9fe8ff',
  };
}

function buildWorldState(players = [], projectiles = []) {
  const nodeBuckets = new Map();
  const now = Date.now();

  players.forEach((player) => {
    if (!player.nearest) return;
    const bucket = nodeBuckets.get(player.nearest) || { key: player.nearest, count: 0, combatants: 0 };
    bucket.count += 1;
    if (player.combatState?.lastShotAt && now - Number(player.combatState.lastShotAt) < 6000) bucket.combatants += 1;
    nodeBuckets.set(player.nearest, bucket);
  });

  const contestedNodes = [...nodeBuckets.values()]
    .filter((bucket) => bucket.count >= 2)
    .sort((a, b) => (b.combatants + b.count) - (a.combatants + a.count))
    .slice(0, 6)
    .map((bucket) => ({
      key: bucket.key,
      pressure: bucket.count,
      combatants: bucket.combatants,
    }));

  const combatHeat = Math.min(
    100,
    Math.round((projectiles.length * 5) + contestedNodes.reduce((sum, node) => sum + node.combatants * 7, 0))
  );
  const anomalyPhase = Number((((now / 1000) % 60) / 60).toFixed(2));
  return { contestedNodes, combatHeat, anomalyPhase };
}

async function maybeCleanup(roomName = ROOM_NAME) {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const now = Date.now();
  if (now % 11 !== 0) return;

  const stalePlayersBefore = new Date(now - CLEANUP_PLAYER_MS).toISOString();
  const staleEventsBefore = new Date(now - CLEANUP_EVENT_MS).toISOString();

  await Promise.allSettled([
    admin.from('multiplayer_players').delete().eq('room_name', roomName).lt('last_seen', stalePlayersBefore),
    admin.from('multiplayer_events').delete().eq('room_name', roomName).lt('created_at', staleEventsBefore),
  ]);
}

async function ensureRoom(roomName = ROOM_NAME) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const timestamp = nowIso();
  await admin.from('multiplayer_rooms').upsert({ room_name: roomName, updated_at: timestamp, last_event_at: timestamp }, { onConflict: 'room_name' });
  return roomName;
}

async function getSessionPlayer({ roomName = ROOM_NAME, id, token }) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from('multiplayer_players')
    .select('*')
    .eq('room_name', roomName)
    .eq('player_id', String(id || ''))
    .maybeSingle();

  if (error || !data || data.session_token !== token) return null;
  return data;
}

async function serializeDurableRoom(roomName = ROOM_NAME) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const playersSince = new Date(Date.now() - PLAYER_TIMEOUT_MS).toISOString();
  const eventsSince = new Date(Date.now() - EVENT_TIMEOUT_MS).toISOString();

  const [{ data: roomRow }, { data: playerRows }, { data: eventRows }] = await Promise.all([
    admin.from('multiplayer_rooms').select('room_name, tick, updated_at').eq('room_name', roomName).maybeSingle(),
    admin
      .from('multiplayer_players')
      .select('*')
      .eq('room_name', roomName)
      .gte('last_seen', playersSince)
      .order('last_seen', { ascending: false })
      .limit(MAX_STATE_PLAYERS),
    admin
      .from('multiplayer_events')
      .select('*')
      .eq('room_name', roomName)
      .eq('event_type', 'fire')
      .gte('created_at', eventsSince)
      .order('created_at', { ascending: false })
      .limit(MAX_STATE_EVENTS),
  ]);

  const players = (playerRows || []).map(sanitizePlayerRow);
  const projectiles = (eventRows || []).map(sanitizeProjectileRow);
  const world = buildWorldState(players, projectiles);

  return {
    authoritative: true,
    durable: true,
    room: roomName,
    tick: Number(roomRow?.tick || Date.now()),
    players,
    projectiles,
    playerCount: players.length,
    world,
  };
}

export function hasDurableMultiplayer() {
  return hasSupabaseAdmin();
}

export async function joinDurableRoom({ roomName = ROOM_NAME, identity = {}, steamUser = null } = {}) {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, status: 503, error: 'DURABLE_MULTIPLAYER_UNAVAILABLE' };

  await ensureRoom(roomName);
  const timestamp = nowIso();
  const resolvedIdentityKind = identity.identityKind || identity.kind || 'guest';
  const resolvedAuthenticated = Boolean(identity.authenticated);
  const id = String(identity.id || `guest-${Date.now().toString(36)}`);

  const { data: existing } = await admin
    .from('multiplayer_players')
    .select('session_token, score, health, shield, joined_at')
    .eq('room_name', roomName)
    .eq('player_id', id)
    .maybeSingle();

  const token = existing?.session_token || createToken();
  const playerRow = {
    room_name: roomName,
    player_id: id,
    session_token: token,
    display_name: identity.displayName || steamUser?.personaname || 'Pilot',
    avatar_url: steamUser?.avatar || null,
    identity_kind: resolvedIdentityKind,
    authenticated: resolvedAuthenticated,
    position: [0, 0, 18],
    velocity: [0, 0, 0],
    direction: [0, 0, -1],
    nearest: 'deep_blackhole',
    speed: 0,
    quantum_signature: 'Q12D-0-0',
    health: clampNumber(existing?.health, 100, 0, 100),
    shield: clampNumber(existing?.shield, 100, 0, 100),
    score: clampNumber(existing?.score, 0, 0, 999999),
    combat_state: { firing: false, lastShotAt: 0 },
    joined_at: existing?.joined_at || timestamp,
    last_seen: timestamp,
    updated_at: timestamp,
  };

  const { error } = await admin.from('multiplayer_players').upsert(playerRow, { onConflict: 'room_name,player_id' });
  if (error) return { ok: false, status: 500, error: 'DURABLE_JOIN_FAILED', detail: error.message };

  const tick = Date.now();
  await admin.from('multiplayer_rooms').update({ tick, updated_at: timestamp }).eq('room_name', roomName);
  await maybeCleanup(roomName);

  return {
    ok: true,
    room: roomName,
    token,
    player: sanitizePlayerRow(playerRow),
    server: { authoritative: true, durable: true, tick },
  };
}

export async function updateDurablePlayer({ roomName = ROOM_NAME, id, token, snapshot = {}, captureSimulationEvent = true } = {}) {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, status: 503, error: 'DURABLE_MULTIPLAYER_UNAVAILABLE' };

  const current = await getSessionPlayer({ roomName, id, token });
  if (!current) return { ok: false, status: 401, error: 'PLAYER_SESSION_INVALID' };
  if (isPlaceholderSnapshot(snapshot) && (clampNumber(current.speed, 0, 0, 500) > 0.01 || current.nearest || current.quantum_signature)) {
    return { ok: false, status: 422, error: 'PLACEHOLDER_SNAPSHOT_REJECTED' };
  }

  const timestamp = nowIso();
  const row = {
    room_name: roomName,
    player_id: String(id),
    session_token: token,
    display_name: current.display_name,
    avatar_url: current.avatar_url,
    identity_kind: current.identity_kind,
    authenticated: current.authenticated,
    position: sanitizeVector(snapshot.position, current.position || [0, 0, 18]).map((v) => Number(v.toFixed(3))),
    velocity: sanitizeVector(snapshot.velocity, current.velocity || [0, 0, 0]).map((v) => Number(v.toFixed(3))),
    direction: sanitizeVector(snapshot.direction, current.direction || [0, 0, -1]).map((v) => Number(v.toFixed(3))),
    nearest: snapshot.nearest || current.nearest || null,
    speed: clampNumber(snapshot.speed, current.speed || 0, 0, 500),
    quantum_signature: snapshot.quantumSignature || current.quantum_signature || 'Q12D-0-0',
    health: clampNumber(current.health, 100, 0, 100),
    shield: clampNumber(current.shield, 100, 0, 100),
    score: clampNumber(current.score, 0, 0, 999999),
    combat_state: {
      firing: Boolean(snapshot.firing),
      lastShotAt: Number(current.combat_state?.lastShotAt || 0),
    },
    joined_at: current.joined_at,
    last_seen: timestamp,
    updated_at: timestamp,
  };

  const { error } = await admin.from('multiplayer_players').upsert(row, { onConflict: 'room_name,player_id' });
  if (error) return { ok: false, status: 500, error: 'DURABLE_STATE_UPDATE_FAILED', detail: error.message };

  const tick = Date.now();
  await admin.from('multiplayer_rooms').update({ tick, updated_at: timestamp }).eq('room_name', roomName);
  if (captureSimulationEvent) {
    await writeSimulationEvent({
      roomName,
      playerId: id,
      sessionId: token,
      frameIndex: snapshot?.frameIndex,
      sampleRate: SIM_EVENT_SAMPLE_RATE_STATE,
      source: 'state',
      physics: {
        input: {
          position: snapshot?.position,
          velocity: snapshot?.velocity,
          gravitySample: snapshot?.gravitySample,
          horizonMetrics: snapshot?.horizonMetrics,
          spinState: snapshot?.spinState,
        },
        output: {
          position: row.position,
          velocity: row.velocity,
          gravitySample: snapshot?.gravitySampleOut || snapshot?.gravitySample,
          horizonMetrics: snapshot?.horizonMetricsOut || snapshot?.horizonMetrics,
          spinState: snapshot?.spinStateOut || snapshot?.spinState,
        },
      },
    });
  }
  const state = await serializeDurableRoom(roomName);
  await maybeCleanup(roomName);

  return { ok: true, room: roomName, tick, state };
}

export async function applyDurableAction({ roomName = ROOM_NAME, id, token, action = {}, captureSimulationEvent = true } = {}) {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, status: 503, error: 'DURABLE_MULTIPLAYER_UNAVAILABLE' };

  const current = await getSessionPlayer({ roomName, id, token });
  if (!current) return { ok: false, status: 401, error: 'PLAYER_SESSION_INVALID' };

  const timestamp = nowIso();
  if (action.type === 'fire') {
    const origin = sanitizeVector(action.origin || current.position || [0, 0, 18], [0, 0, 18]);
    const direction = sanitizeVector(action.velocity || current.direction || [0, 0, -1], [0, 0, -1]);
    const velocity = direction.map((value) => Number((value * 18).toFixed(3)));
    const eventRow = {
      id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      room_name: roomName,
      event_type: 'fire',
      player_id: String(id),
      payload: {
        origin,
        position: origin,
        velocity,
        color: action.color || '#9fe8ff',
      },
      created_at: timestamp,
    };
    const { error: eventError } = await admin.from('multiplayer_events').insert(eventRow);
    if (eventError) return { ok: false, status: 500, error: 'DURABLE_ACTION_FAILED', detail: eventError.message };

    await admin
      .from('multiplayer_players')
      .update({
        combat_state: { firing: true, lastShotAt: Date.now() },
        score: clampNumber(current.score, 0, 0, 999999) + 1,
        last_seen: timestamp,
        updated_at: timestamp,
      })
      .eq('room_name', roomName)
      .eq('player_id', String(id));
  }

  if (captureSimulationEvent) {
    await writeSimulationEvent({
      roomName,
      playerId: id,
      sessionId: token,
      frameIndex: action?.frameIndex,
      sampleRate: SIM_EVENT_SAMPLE_RATE_ACTION,
      source: `action:${action?.type || 'unknown'}`,
      physics: {
        input: {
          position: action?.origin || current.position,
          velocity: action?.velocity || current.velocity,
          gravitySample: action?.gravitySample,
          horizonMetrics: action?.horizonMetrics,
          spinState: action?.spinState,
        },
        output: {
          position: current.position,
          velocity: current.velocity,
          gravitySample: action?.gravitySampleOut || action?.gravitySample,
          horizonMetrics: action?.horizonMetricsOut || action?.horizonMetrics,
          spinState: action?.spinStateOut || action?.spinState,
        },
      },
    });
  }

  const tick = Date.now();
  await admin.from('multiplayer_rooms').update({ tick, updated_at: timestamp, last_event_at: timestamp }).eq('room_name', roomName);
  const state = await serializeDurableRoom(roomName);
  await maybeCleanup(roomName);
  return { ok: true, room: roomName, tick, state };
}

export async function listSimulationEvents({
  roomName = ROOM_NAME,
  playerId,
  sessionId,
  fromTimestamp,
  toTimestamp,
  limit = SIM_EVENT_QUERY_LIMIT,
} = {}) {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, status: 503, error: 'DURABLE_MULTIPLAYER_UNAVAILABLE' };

  let query = admin
    .from('simulation_events')
    .select('*')
    .eq('room_name', roomName)
    .order('event_timestamp', { ascending: false })
    .limit(clampNumber(limit, SIM_EVENT_QUERY_LIMIT, 1, 1000));

  if (playerId) query = query.eq('player_id', String(playerId));
  if (sessionId) query = query.eq('session_id', String(sessionId));
  if (fromTimestamp) query = query.gte('event_timestamp', new Date(fromTimestamp).toISOString());
  if (toTimestamp) query = query.lte('event_timestamp', new Date(toTimestamp).toISOString());

  const { data, error } = await query;
  if (error) return { ok: false, status: 500, error: 'SIM_EVENT_QUERY_FAILED', detail: error.message };

  return {
    ok: true,
    room: roomName,
    count: data?.length || 0,
    events: data || [],
  };
}

export async function runSymmetryValidator({
  roomName = ROOM_NAME,
  fromTimestamp,
  toTimestamp,
  limit = SYMMETRY_MAX_EVENTS,
} = {}) {
  const result = await listSimulationEvents({ roomName, fromTimestamp, toTimestamp, limit });
  if (!result.ok) return result;
  const report = validateSimulationSymmetry(result.events || []);

  return {
    ok: true,
    room: roomName,
    checked: report.checked,
    report,
  };
}

export async function getDurableState({ roomName = ROOM_NAME, id, token } = {}) {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, status: 503, error: 'DURABLE_MULTIPLAYER_UNAVAILABLE' };

  const current = await getSessionPlayer({ roomName, id, token });
  if (!current) return { ok: false, status: 401, error: 'PLAYER_SESSION_INVALID' };

  const state = await serializeDurableRoom(roomName);
  return { ok: true, room: roomName, tick: state?.tick || Date.now(), state };
}

export async function disconnectDurablePlayer({ roomName = ROOM_NAME, id, token } = {}) {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, status: 503, error: 'DURABLE_MULTIPLAYER_UNAVAILABLE' };
  const current = await getSessionPlayer({ roomName, id, token });
  if (!current) return { ok: true };
  await admin.from('multiplayer_players').delete().eq('room_name', roomName).eq('player_id', String(id));
  return { ok: true };
}

export async function cleanupDurableRoom({ roomName = ROOM_NAME } = {}) {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, status: 503, error: 'DURABLE_MULTIPLAYER_UNAVAILABLE' };
  const stalePlayersBefore = new Date(Date.now() - CLEANUP_PLAYER_MS).toISOString();
  const staleEventsBefore = new Date(Date.now() - CLEANUP_EVENT_MS).toISOString();
  await Promise.all([
    admin.from('multiplayer_players').delete().eq('room_name', roomName).lt('last_seen', stalePlayersBefore),
    admin.from('multiplayer_events').delete().eq('room_name', roomName).lt('created_at', staleEventsBefore),
  ]);
  return { ok: true };
}
