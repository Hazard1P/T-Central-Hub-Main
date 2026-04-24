export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAuthoritativeState, updateAuthoritativePlayer, pruneAuthoritativeRooms } from '@/lib/authoritativeMultiplayerStore';
import { getDurableState, hasDurableMultiplayer, updateDurablePlayer } from '@/lib/durableMultiplayerStore';
import { SESSION_MODES, buildRingAdjustmentOutputs, getSessionModeSnapshot, normalizeSessionMode, transitionSessionMode } from '@/lib/sessionModeEngine';
import { trackServerEvent } from '@/lib/server/vercelTelemetry';

const QUERY_TOKEN_DEPRECATION_END_AT = Date.parse('2026-05-15T00:00:00.000Z');
const TOKEN_HEADER_CANDIDATES = ['x-multiplayer-token', 'x-session-token'];

function resolveRequestedMode(input = {}, fallback = SESSION_MODES.MULTI_PLAYER) {
  return normalizeSessionMode(input?.mode || input?.lobbyMode, fallback);
}

function getBearerTokenFromAuthorizationHeader(authorization = '') {
  if (typeof authorization !== 'string') return undefined;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

function resolveRequestToken(request, searchParams) {
  const bearerToken = getBearerTokenFromAuthorizationHeader(request.headers.get('authorization'));
  if (bearerToken) return { token: bearerToken, source: 'authorization' };

  for (const headerName of TOKEN_HEADER_CANDIDATES) {
    const headerToken = request.headers.get(headerName)?.trim();
    if (headerToken) return { token: headerToken, source: headerName };
  }

  const queryToken = searchParams.get('token') || undefined;
  if (!queryToken) return { token: undefined, source: 'missing' };
  if (Date.now() < QUERY_TOKEN_DEPRECATION_END_AT) return { token: queryToken, source: 'query_compat' };
  return { token: undefined, source: 'query_blocked' };
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
  const tokenResolution = resolveRequestToken(request, searchParams);
  const requestedMode = resolveRequestedMode(
    { mode: searchParams.get('mode'), lobbyMode: searchParams.get('lobbyMode') },
    getSessionModeSnapshot(roomName).mode || SESSION_MODES.MULTI_PLAYER
  );

  if (tokenResolution.source === 'query_compat') {
    await trackServerEvent('api_multiplayer_state_token_deprecation', {
      method: 'GET',
      roomName,
      fallback: 'query_param',
      deprecatedUntil: new Date(QUERY_TOKEN_DEPRECATION_END_AT).toISOString(),
    });
  } else if (tokenResolution.source === 'query_blocked') {
    await trackServerEvent('api_multiplayer_state_token_rejected', {
      method: 'GET',
      roomName,
      reason: 'query_param_after_deprecation_window',
    });
  }

  if (hasDurableMultiplayer()) {
    const result = await getDurableState({
      roomName,
      id: searchParams.get('id') || undefined,
      token: tokenResolution.token,
    });
    const payload = withModeState(result, { roomName, mode: requestedMode, source: 'state:get' });
    await trackServerEvent('api_multiplayer_state', { method: 'GET', durable: true, status: result.status || 200 });
    const response = NextResponse.json(payload, { status: result.status || 200 });
    if (tokenResolution.source === 'query_compat') {
      response.headers.set('Warning', '299 - "Query token is deprecated; use Authorization Bearer or x-multiplayer-token."');
      response.headers.set('X-Token-Deprecation', new Date(QUERY_TOKEN_DEPRECATION_END_AT).toISOString());
    }
    return response;
  }

  pruneAuthoritativeRooms();
  const result = getAuthoritativeState({
    roomName,
    id: searchParams.get('id') || undefined,
    token: tokenResolution.token,
  });
  const payload = withModeState({ ...result, durable: false }, { roomName, mode: requestedMode, source: 'state:get' });
  await trackServerEvent('api_multiplayer_state', { method: 'GET', durable: false, status: result.status || 200 });
  const response = NextResponse.json(payload, { status: result.status || 200 });
  if (tokenResolution.source === 'query_compat') {
    response.headers.set('Warning', '299 - "Query token is deprecated; use Authorization Bearer or x-multiplayer-token."');
    response.headers.set('X-Token-Deprecation', new Date(QUERY_TOKEN_DEPRECATION_END_AT).toISOString());
  }
  return response;
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
    const payload = withModeState(result, { roomName, mode: requestedMode, source: 'state:post' });
    await trackServerEvent('api_multiplayer_state', { method: 'POST', durable: true, status: result.status || 200 });
    return NextResponse.json(payload, { status: result.status || 200 });
  }

  pruneAuthoritativeRooms();
  const result = updateAuthoritativePlayer({
    roomName,
    id: body?.id,
    token: body?.token,
    snapshot: body?.snapshot,
  });
  const payload = withModeState({ ...result, durable: false }, { roomName, mode: requestedMode, source: 'state:post' });
  await trackServerEvent('api_multiplayer_state', { method: 'POST', durable: false, status: result.status || 200 });
  return NextResponse.json(payload, { status: result.status || 200 });
}
