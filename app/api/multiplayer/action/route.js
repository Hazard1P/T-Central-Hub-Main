export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { applyAuthoritativeAction, pruneAuthoritativeRooms } from '@/lib/authoritativeMultiplayerStore';
import { applyDurableAction, hasDurableMultiplayer } from '@/lib/durableMultiplayerStore';
import { SESSION_MODES, buildRingAdjustmentOutputs, getSessionModeSnapshot, normalizeSessionMode, transitionSessionMode } from '@/lib/sessionModeEngine';
import { trackServerEvent } from '@/lib/server/vercelTelemetry';
import { awardMultiplayerProgressionEvent } from '@/lib/multiplayerProgression';

function resolveRequestedMode(body = {}, fallback = SESSION_MODES.MULTI_PLAYER) {
  return normalizeSessionMode(body?.mode || body?.lobbyMode, fallback);
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
  const body = await request.json().catch(() => ({}));
  const roomName = body?.roomName;
  const requestedMode = resolveRequestedMode(body, getSessionModeSnapshot(roomName).mode || SESSION_MODES.MULTI_PLAYER);

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
      id: body?.id,
      token: body?.token,
      action: body?.action,
      captureSimulationEvent: body?.captureSimulationEvent !== false,
    });
    const progression = await progressionPromise;
    const payload = withModeState({ ...result, progressionDelta: progression?.delta || null }, { roomName, mode: requestedMode, source: 'action' });
    await trackServerEvent('api_multiplayer_action', { durable: true, status: result.status || 200 });
    return NextResponse.json(payload, { status: result.status || 200 });
  }

  pruneAuthoritativeRooms();
  const result = applyAuthoritativeAction({
    roomName,
    id: body?.id,
    token: body?.token,
    action: body?.action,
  });
  const progression = await progressionPromise;
  const payload = withModeState({ ...result, durable: false, progressionDelta: progression?.delta || null }, { roomName, mode: requestedMode, source: 'action' });
  await trackServerEvent('api_multiplayer_action', { durable: false, status: result.status || 200 });
  return NextResponse.json(payload, { status: result.status || 200 });
}
