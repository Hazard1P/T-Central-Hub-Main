export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthoritativeState, updateAuthoritativePlayer, pruneAuthoritativeRooms } from '@/lib/authoritativeMultiplayerStore';
import { getDurableState, hasDurableMultiplayer, updateDurablePlayer } from '@/lib/durableMultiplayerStore';
import { SESSION_MODES, buildRingAdjustmentOutputs, getSessionModeSnapshot, normalizeSessionMode, transitionSessionMode } from '@/lib/sessionModeEngine';

function resolveRequestedMode(input = {}, fallback = SESSION_MODES.MULTI_PLAYER) {
  return normalizeSessionMode(input?.mode || input?.lobbyMode, fallback);
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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const roomName = searchParams.get('roomName') || undefined;
  const requestedMode = resolveRequestedMode(
    { mode: searchParams.get('mode'), lobbyMode: searchParams.get('lobbyMode') },
    getSessionModeSnapshot(roomName).mode || SESSION_MODES.MULTI_PLAYER
  );

  if (hasDurableMultiplayer()) {
    const result = await getDurableState({
      roomName,
      id: searchParams.get('id') || undefined,
      token: searchParams.get('token') || undefined,
    });
    return NextResponse.json(withModeState(result, { roomName, mode: requestedMode, source: 'state:get' }), { status: result.status || 200 });
  }

  pruneAuthoritativeRooms();
  const result = getAuthoritativeState({
    roomName,
    id: searchParams.get('id') || undefined,
    token: searchParams.get('token') || undefined,
  });
  return NextResponse.json(withModeState({ ...result, durable: false }, { roomName, mode: requestedMode, source: 'state:get' }), { status: result.status || 200 });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const roomName = body?.roomName;
  const requestedMode = resolveRequestedMode(body, getSessionModeSnapshot(roomName).mode || SESSION_MODES.MULTI_PLAYER);

  if (hasDurableMultiplayer()) {
    const result = await updateDurablePlayer({
      roomName,
      id: body?.id,
      token: body?.token,
      snapshot: body?.snapshot,
      captureSimulationEvent: body?.captureSimulationEvent !== false,
    });
    return NextResponse.json(withModeState(result, { roomName, mode: requestedMode, source: 'state:post' }), { status: result.status || 200 });
  }

  pruneAuthoritativeRooms();
  const result = updateAuthoritativePlayer({
    roomName,
    id: body?.id,
    token: body?.token,
    snapshot: body?.snapshot,
  });
  return NextResponse.json(withModeState({ ...result, durable: false }, { roomName, mode: requestedMode, source: 'state:post' }), { status: result.status || 200 });
}
