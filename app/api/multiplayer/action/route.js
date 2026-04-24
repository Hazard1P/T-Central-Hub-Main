export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { applyAuthoritativeAction, pruneAuthoritativeRooms } from '@/lib/authoritativeMultiplayerStore';
import { applyDurableAction, hasDurableMultiplayer } from '@/lib/durableMultiplayerStore';
import { SESSION_MODES, buildRingAdjustmentOutputs, getSessionModeSnapshot, normalizeSessionMode, transitionSessionMode } from '@/lib/sessionModeEngine';
import { trackServerEvent } from '@/lib/server/vercelTelemetry';

const ROOM_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const ACTION_TYPE_WHITELIST = new Set(['fire']);
const SUPPORTED_SESSION_MODES = new Set(Object.values(SESSION_MODES));

function sanitizeRoomName(value) {
  const roomName = String(value ?? '').trim();
  if (!ROOM_NAME_PATTERN.test(roomName)) return null;
  return roomName;
}

function validateRequiredString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function resolveRequestedMode(body = {}, fallback = SESSION_MODES.MULTI_PLAYER) {
  const modeInput = body?.mode ?? body?.lobbyMode;
  if (modeInput === undefined || modeInput === null || modeInput === '') {
    return { ok: true, mode: fallback };
  }

  const normalizedMode = normalizeSessionMode(modeInput, null);
  if (!normalizedMode || !SUPPORTED_SESSION_MODES.has(normalizedMode)) {
    return { ok: false, field: body?.mode !== undefined ? 'mode' : 'lobbyMode', value: modeInput };
  }

  return { ok: true, mode: normalizedMode };
}

function validateActionPayload(body) {
  const issues = [];
  const roomName = sanitizeRoomName(body?.roomName);
  if (!roomName) {
    issues.push({ field: 'roomName', message: 'roomName must match ^[a-zA-Z0-9_-]{1,64}$' });
  }

  if (!validateRequiredString(body?.id)) {
    issues.push({ field: 'id', message: 'id is required and must be a non-empty string' });
  }

  if (!validateRequiredString(body?.token)) {
    issues.push({ field: 'token', message: 'token is required and must be a non-empty string' });
  }

  if (!body?.action || typeof body.action !== 'object' || Array.isArray(body.action)) {
    issues.push({ field: 'action', message: 'action is required and must be an object' });
  } else if (!ACTION_TYPE_WHITELIST.has(body.action.type)) {
    issues.push({ field: 'action.type', message: `action.type must be one of: ${[...ACTION_TYPE_WHITELIST].join(', ')}` });
  }

  const modeSnapshot = getSessionModeSnapshot(roomName || undefined);
  const modeResolution = resolveRequestedMode(body, modeSnapshot.mode || SESSION_MODES.MULTI_PLAYER);
  if (!modeResolution.ok) {
    issues.push({ field: modeResolution.field, message: `Unsupported mode value: ${String(modeResolution.value)}` });
  }

  if (issues.length > 0) {
    return { ok: false, status: 400, error: 'INVALID_ACTION_PAYLOAD', issues };
  }

  return {
    ok: true,
    value: {
      roomName,
      id: body.id,
      token: body.token,
      action: body.action,
      requestedMode: modeResolution.mode,
      captureSimulationEvent: body?.captureSimulationEvent !== false,
    },
  };
}

function withModeState(result = {}, { roomName, mode, source } = {}) {
  const modeState = transitionSessionMode({ roomName, to: mode, source });
  const state = result?.state || {};
  const ringAdjustments = buildRingAdjustmentOutputs({
    roomName,
    mode: modeState.mode,
    playerCount: state.playerCount || 0,
    eventThroughput: (state.projectiles || []).length,
    combatHeat: state?.world?.combatHeat || 0,
  });

  return {
    ...result,
    mode: modeState.mode,
    modeTransition: modeState.transition,
    ringAdjustments,
    state: {
      ...state,
      mode: modeState.mode,
      modeTransition: modeState.transition,
      ringAdjustments,
    },
  };
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({
      ok: false,
      error: 'INVALID_ACTION_PAYLOAD',
      issues: [{ field: 'body', message: 'Body must be a JSON object' }],
    }, { status: 400 });
  }

  const validation = validateActionPayload(body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error, issues: validation.issues }, { status: validation.status });
  }

  const { roomName, id, token, action, requestedMode, captureSimulationEvent } = validation.value;

  if (hasDurableMultiplayer()) {
    const result = await applyDurableAction({
      roomName,
      id,
      token,
      action,
      captureSimulationEvent,
    });
    const payload = withModeState(result, { roomName, mode: requestedMode, source: 'action' });
    await trackServerEvent('api_multiplayer_action', { durable: true, status: result.status || 200 });
    return NextResponse.json(payload, { status: result.status || 200 });
  }

  pruneAuthoritativeRooms();
  const result = applyAuthoritativeAction({
    roomName,
    id,
    token,
    action,
  });
  const payload = withModeState({ ...result, durable: false }, { roomName, mode: requestedMode, source: 'action' });
  await trackServerEvent('api_multiplayer_action', { durable: false, status: result.status || 200 });
  return NextResponse.json(payload, { status: result.status || 200 });
}
