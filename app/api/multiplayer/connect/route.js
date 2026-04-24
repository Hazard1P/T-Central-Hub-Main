import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { joinAuthoritativeRoom, pruneAuthoritativeRooms } from '@/lib/authoritativeMultiplayerStore';
import { hasDurableMultiplayer, joinDurableRoom } from '@/lib/durableMultiplayerStore';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';
import { SESSION_MODES, buildRingAdjustmentOutputs, normalizeSessionMode, transitionSessionMode } from '@/lib/sessionModeEngine';

const ROOM_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const GUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{3,64}$/;

function sanitizeRoomName(value) {
  const roomName = String(value ?? '').trim();
  if (!ROOM_NAME_PATTERN.test(roomName)) return null;
  return roomName;
}

function sanitizeDisplayName(value, fallback = 'Pilot') {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N} ._\-]/gu, '')
    .slice(0, 32);
  return normalized || fallback;
}

function toApiAuthContext(authContext) {
  return {
    authenticated: authContext.authenticated,
    provider: authContext.provider,
    accountId: authContext.accountId,
    displayName: authContext.displayName,
    identityKind: authContext.identityKind,
  };
}

function resolveIdentity(body = {}, authContext) {
  if (authContext?.authenticated && authContext?.accountId) {
    return {
      id: String(authContext.accountId),
      displayName: sanitizeDisplayName(authContext.displayName, 'Pilot'),
      identityKind: authContext.identityKind || authContext.provider || 'member',
      authenticated: true,
      steamUser: authContext.steamUser,
    };
  }

  const candidateGuestId = String(body?.identity?.id || body?.guestId || '')
    .trim()
    .toLowerCase();
  const guestSuffix = GUEST_ID_PATTERN.test(candidateGuestId)
    ? candidateGuestId
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

  return {
    id: `guest-${guestSuffix}`,
    displayName: sanitizeDisplayName(body?.identity?.displayName || body?.displayName, 'Guest Pilot'),
    identityKind: 'guest',
    authenticated: false,
    steamUser: null,
  };
}


function resolveRequestedMode(body = {}) {
  return normalizeSessionMode(body?.mode || body?.lobbyMode, SESSION_MODES.MULTI_PLAYER);
}

function withModePayload(payload = {}, { roomName, mode, source, playerCount = 0, eventThroughput = 0, combatHeat = 0 } = {}) {
  const modeState = transitionSessionMode({ roomName, to: mode, source });
  const ringAdjustments = buildRingAdjustmentOutputs({ roomName, mode: modeState.mode, playerCount, eventThroughput, combatHeat });

  return {
    ...payload,
    mode: modeState.mode,
    modeTransition: modeState.transition,
    ringAdjustments,
    server: payload?.server
      ? { ...payload.server, mode: modeState.mode, modeTransition: modeState.transition }
      : payload?.server,
  };
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  const roomName = sanitizeRoomName(body.roomName);
  if (!roomName) {
    return NextResponse.json({ ok: false, error: 'Invalid roomName' }, { status: 400 });
  }

  const authContext = resolveGameAuthContext(cookies());
  const identity = resolveIdentity(body, authContext);
  const responseAuthContext = toApiAuthContext(authContext);
  const requestedMode = resolveRequestedMode(body);

  if (hasDurableMultiplayer()) {
    const result = await joinDurableRoom({
      roomName,
      identity,
      steamUser: identity.steamUser,
    });
    // Frontend consumers expect mode, modeTransition, and ringAdjustments fields on connect responses.
    const payload = withModePayload(
      { ...result, authContext: responseAuthContext },
      {
        roomName,
        mode: requestedMode,
        source: 'connect',
        playerCount: result?.state?.playerCount || 0,
      }
    );
    return NextResponse.json(payload, { status: result.status || 200 });
  }

  pruneAuthoritativeRooms();
  const result = joinAuthoritativeRoom({
    roomName,
    identity,
    steamUser: identity.steamUser,
  });
  // Frontend consumers expect mode, modeTransition, and ringAdjustments fields on connect responses.
  const payload = withModePayload(
    { ...result, durable: false, authContext: responseAuthContext },
    {
      roomName,
      mode: requestedMode,
      source: 'connect',
      playerCount: result?.state?.playerCount || 0,
    }
  );
  return NextResponse.json(payload);
}
