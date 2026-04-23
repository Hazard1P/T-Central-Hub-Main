import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { joinAuthoritativeRoom, pruneAuthoritativeRooms } from '@/lib/authoritativeMultiplayerStore';
import { hasDurableMultiplayer, joinDurableRoom } from '@/lib/durableMultiplayerStore';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';

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

  if (hasDurableMultiplayer()) {
    const result = await joinDurableRoom({
      roomName,
      identity,
      steamUser: identity.steamUser,
    });
    return NextResponse.json({ ...result, authContext: responseAuthContext }, { status: result.status || 200 });
  }

  pruneAuthoritativeRooms();
  const result = joinAuthoritativeRoom({
    roomName,
    identity,
    steamUser: identity.steamUser,
  });
  return NextResponse.json({ ...result, durable: false, authContext: responseAuthContext });
}
