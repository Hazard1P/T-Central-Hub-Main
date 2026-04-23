export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { applyAuthoritativeAction, pruneAuthoritativeRooms } from '@/lib/authoritativeMultiplayerStore';
import { applyDurableAction, hasDurableMultiplayer } from '@/lib/durableMultiplayerStore';
import { SESSION_MODES, buildRingAdjustmentOutputs, getSessionModeSnapshot, normalizeSessionMode, transitionSessionMode } from '@/lib/sessionModeEngine';


function resolveRequestedMode(body = {}, fallback = SESSION_MODES.MULTI_PLAYER) {
  return normalizeSessionMode(body?.mode || body?.lobbyMode, fallback);
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

  if (hasDurableMultiplayer()) {
    const result = await applyDurableAction({
      roomName,
      id: body?.id,
      token: body?.token,
      action: body?.action,
      captureSimulationEvent: body?.captureSimulationEvent !== false,
    });
    return NextResponse.json(withModeState(result, { roomName, mode: requestedMode, source: 'action' }), { status: result.status || 200 });
  }

  pruneAuthoritativeRooms();
  const result = applyAuthoritativeAction({
    roomName,
    id: body?.id,
    token: body?.token,
    action: body?.action,
  });
  return NextResponse.json(withModeState({ ...result, durable: false }, { roomName, mode: requestedMode, source: 'action' }), { status: result.status || 200 });
}
