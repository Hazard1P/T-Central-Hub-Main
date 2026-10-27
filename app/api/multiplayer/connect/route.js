import { moderation } from '@/lib/server/moderationStore';
import { banDenial } from '@/lib/moderation';
import { resolveAccountUsername } from '@/lib/server/accountUsernameStore';
import { hasRealtimeServer, realtimeTicket, requiresRealtimeServer } from '@/lib/server/realtimeBridge';
import { allowsMemoryMultiplayer } from '@/lib/multiplayerCapacity';
import { isSameOriginPaymentRequest } from '@/lib/paymentRequest';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { joinAuthoritativeRoom, pruneAuthoritativeRooms } from '@/lib/authoritativeMultiplayerStore';
import { hasDurableMultiplayer, joinDurableRoom } from '@/lib/durableMultiplayerStore';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';
import { awardMultiplayerProgressionEvent } from '@/lib/multiplayerProgression';
import { SESSION_MODES, buildRingAdjustmentOutputs, getSessionModeSnapshot, normalizeSessionMode, transitionSessionMode } from '@/lib/sessionModeEngine';
import { createModeBridgeTransfer, rehydrateModeBridgeState, validateModeBridgeTransfer } from '@/lib/persistence/modeBridgeState';
import { resolveGuestPilotSession } from '@/lib/guestPilotIdentity';

const ROOM_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

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

function resolveScopedAccountId(authContext) {
  if (!authContext?.provider || !authContext?.accountId) return null;
  return `${String(authContext.provider).toLowerCase()}:${String(authContext.accountId)}`;
}

function resolveIdentity(body = {}, authContext, guestSession) {
  const scopedAccountId = resolveScopedAccountId(authContext);
  if (authContext?.authenticated && scopedAccountId) {
    return {
      id: scopedAccountId,
      displayName: String(authContext.displayName || 'Pilot').replace(/[\x00-\x1f\x7f]/g, '').slice(0, 160),
      identityKind: authContext.identityKind || authContext.provider || 'member',
      authenticated: true,
      steamUser: authContext.steamUser,
    };
  }

  return {
    id: guestSession.id,
    displayName: sanitizeDisplayName(body?.identity?.displayName || body?.displayName, 'Guest Pilot'),
    identityKind: 'guest',
    authenticated: false,
    steamUser: null,
  };
}

function sessionResponse(payload, guestSession, status = 200) {
  const response = NextResponse.json(payload, { status, headers: { 'Cache-Control':'private, no-store', ...(payload.retryAfter ? {'Retry-After':String(payload.retryAfter)} : {}) } });
  if (guestSession?.setCookie) response.cookies.set('tcentral_guest_pilot', guestSession.value, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
  });
  return response;
}




function isBridgeTransition(fromMode, toMode) {
  return (fromMode === SESSION_MODES.SINGLE_PLAYER && toMode === SESSION_MODES.MULTI_PLAYER)
    || (fromMode === SESSION_MODES.MULTI_PLAYER && toMode === SESSION_MODES.SINGLE_PLAYER);
}

function applyModeBridge(payload = {}, { roomName, identity, authContext, incomingTransfer, incomingState } = {}) {
  const modeTransition = payload?.modeTransition || {};
  const validation = validateModeBridgeTransfer({
    transfer: incomingTransfer,
    roomName,
    sessionAnchor: identity?.id,
    accountAnchor: authContext?.accountId || identity?.id,
  });

  if (!validation.ok) return { ok: false, status: validation.status, error: validation.error, details: validation.details };

  const modeBridgeTransfer = createModeBridgeTransfer({
    incomingTransfer,
    modeTransition,
    mode: payload?.mode,
    roomName,
    sessionAnchor: identity?.id,
    accountAnchor: authContext?.accountId || identity?.id,
    modeBridgeState: incomingState,
  });

  return {
    ok: true,
    payload: {
      ...payload,
      modeBridgeTransfer,
      modeBridgeState: modeBridgeTransfer.state,
    },
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
  if (!isSameOriginPaymentRequest(request)) return NextResponse.json({ ok:false,error:'SAME_ORIGIN_REQUIRED' },{status:403});
  if (!hasRealtimeServer() && requiresRealtimeServer()) return NextResponse.json({ok:false,error:'REALTIME_SETUP_REQUIRED'}, {status:503});
  if (!hasRealtimeServer() && !hasDurableMultiplayer() && !allowsMemoryMultiplayer()) return NextResponse.json({ok:false,error:'MULTIPLAYER_SETUP_REQUIRED'}, {status:503});
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  const roomName = sanitizeRoomName(body.roomName);
  if (!roomName) {
    return NextResponse.json({ ok: false, error: 'Invalid roomName' }, { status: 400 });
  }

  const cookieStore = cookies();
  const authContext = await resolveAccountUsername(resolveGameAuthContext(cookieStore));
  const guestSession = authContext.authenticated ? null : resolveGuestPilotSession(cookieStore.get('tcentral_guest_pilot')?.value);
  const identity = resolveIdentity(body, authContext, guestSession);
  const access = banDenial(await moderation().access([identity.id]), identity.id);
  if (!access.ok) return sessionResponse(access, guestSession, access.status);
  if (hasRealtimeServer()) return sessionResponse(realtimeTicket(identity,roomName),guestSession);
  const responseAuthContext = toApiAuthContext(authContext);
  const requestedMode = resolveRequestedMode(body);
  const incomingTransfer = body?.modeBridgeTransfer && typeof body.modeBridgeTransfer === 'object' ? body.modeBridgeTransfer : null;
  const incomingState = rehydrateModeBridgeState(body?.modeBridgeState || incomingTransfer?.state);

  const modeSnapshot = getSessionModeSnapshot(roomName).mode || SESSION_MODES.IDLE;
  if (isBridgeTransition(modeSnapshot, requestedMode)) {
    const transferValidation = validateModeBridgeTransfer({
      transfer: incomingTransfer,
      roomName,
      sessionAnchor: identity?.id,
      accountAnchor: authContext?.accountId || identity?.id,
    });
    if (!transferValidation.ok) {
      return NextResponse.json({ ok: false, error: transferValidation.error, details: transferValidation.details || null }, { status: transferValidation.status || 409 });
    }
  }

  const joinEventId = `connect-${roomName}-${identity.id}`;
  const progression = () => awardMultiplayerProgressionEvent({
    playerId: identity.id,
    roomName,
    eventId: joinEventId,
    trigger: 'first_join',
    sessionId: joinEventId,
    displayName: identity.displayName,
  });

  if (hasDurableMultiplayer()) {
    const result = await joinDurableRoom({
      roomName,
      identity,
      steamUser: identity.steamUser,
    });
    if (!result.ok) return sessionResponse(result,guestSession,result.status || 503);
    const awarded = await progression();
    // Frontend consumers expect mode, modeTransition, and ringAdjustments fields on connect responses.
    const payload = withModePayload(
      {
        ...result,
        authContext: responseAuthContext,
        progressionDelta: awarded?.delta || null,
      },
      {
        roomName,
        mode: requestedMode,
        source: 'connect',
        playerCount: result?.population?.playerCount || 0,
      }
    );
    const bridgePayload = applyModeBridge(payload, { roomName, identity, authContext, incomingTransfer, incomingState });
    if (!bridgePayload.ok) {
      return NextResponse.json({ ok: false, error: bridgePayload.error, details: bridgePayload.details || null }, { status: bridgePayload.status || 409 });
    }
    return sessionResponse(bridgePayload.payload, guestSession, result.status || 200);
  }

  pruneAuthoritativeRooms();
  const result = joinAuthoritativeRoom({
    roomName,
    identity,
    steamUser: identity.steamUser,
  });
  if (!result.ok) return sessionResponse(result,guestSession,result.status || 503);
  const awarded = await progression();
  // Frontend consumers expect mode, modeTransition, and ringAdjustments fields on connect responses.
  const payload = withModePayload(
    {
      ...result,
      durable: false,
      authContext: responseAuthContext,
      progressionDelta: awarded?.delta || null,
    },
    {
      roomName,
      mode: requestedMode,
      source: 'connect',
      playerCount: result?.population?.playerCount || 0,
    }
  );
  const bridgePayload = applyModeBridge(payload, { roomName, identity, authContext, incomingTransfer, incomingState });
  if (!bridgePayload.ok) {
    return NextResponse.json({ ok: false, error: bridgePayload.error, details: bridgePayload.details || null }, { status: bridgePayload.status || 409 });
  }
  return sessionResponse(bridgePayload.payload, guestSession);
}
