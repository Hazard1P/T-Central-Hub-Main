export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { applyAuthoritativeAction, pruneAuthoritativeRooms } from '@/lib/authoritativeMultiplayerStore';
import { applyDurableAction, hasDurableMultiplayer } from '@/lib/durableMultiplayerStore';
import { SESSION_MODES, buildRingAdjustmentOutputs, getSessionModeSnapshot, normalizeSessionMode, transitionSessionMode } from '@/lib/sessionModeEngine';
import { trackServerEvent } from '@/lib/server/vercelTelemetry';
import { awardMultiplayerProgressionEvent } from '@/lib/multiplayerProgression';
import { attachRing1Continuity } from '@/lib/ring1Continuity';
import { runRing1Reconciliation } from '@/lib/integrations/synapticsSecondsMeterAdapter';

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

function resolveProgressionTrigger(action = {}) {
  if (action?.type === 'fire') return 'combat_contribution';
  if (['objective', 'objective_capture', 'objective_tick', 'objective_assist'].includes(action?.type)) return 'objective_participation';
  if (['session_complete', 'match_complete', 'extract'].includes(action?.type)) return 'session_completion';
  return null;
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
    modeChanged: modeState.changed,
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

  const progressionTrigger = resolveProgressionTrigger(body?.action);
  const progressionEventId = String(
    body?.action?.progressionEventId
    || body?.action?.eventId
    || body?.action?.id
    || `${body?.action?.type || 'action'}-${body?.action?.frameIndex || body?.action?.tick || Date.now()}`
  );
  const progressionPromise = progressionTrigger
    ? awardMultiplayerProgressionEvent({
      playerId: body?.id,
      roomName,
      eventId: progressionEventId,
      trigger: progressionTrigger,
      sessionId: body?.token,
      displayName: body?.displayName,
    })
    : Promise.resolve(null);

  if (hasDurableMultiplayer()) {
    const result = await applyDurableAction({
      roomName,
      id,
      token,
      action,
      captureSimulationEvent,
    });
    const progression = await progressionPromise;
    const payload = withModeState({ ...result, progressionDelta: progression?.delta || null }, { roomName, mode: requestedMode, source: 'action' });
    const payloadWithContinuity = await attachRing1Continuity(payload, {
      roomName,
      playerId: id,
      sessionToken: token,
      requestedMode,
      source: 'multiplayer:action',
      actionType: action?.type,
      runReconciliation: runRing1Reconciliation,
    });
    await trackServerEvent('api_multiplayer_action', { durable: true, status: result.status || 200 });
    return NextResponse.json(payloadWithContinuity, { status: result.status || 200 });
  }

  pruneAuthoritativeRooms();
  const result = applyAuthoritativeAction({
    roomName,
    id,
    token,
    action,
  });
  const progression = await progressionPromise;
  const payload = withModeState({ ...result, durable: false, progressionDelta: progression?.delta || null }, { roomName, mode: requestedMode, source: 'action' });
  const payloadWithContinuity = await attachRing1Continuity(payload, {
    roomName,
    playerId: id,
    sessionToken: token,
    requestedMode,
    source: 'multiplayer:action',
    actionType: action?.type,
    runReconciliation: runRing1Reconciliation,
  });
  await trackServerEvent('api_multiplayer_action', { durable: false, status: result.status || 200 });
  return NextResponse.json(payloadWithContinuity, { status: result.status || 200 });
}
