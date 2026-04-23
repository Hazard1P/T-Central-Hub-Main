export const dynamic = 'force-dynamic';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { joinAuthoritativeRoom, pruneAuthoritativeRooms } from '@/lib/authoritativeMultiplayerStore';
import { hasDurableMultiplayer, joinDurableRoom } from '@/lib/durableMultiplayerStore';
import { decryptJson } from '@/lib/security';

const ROOM_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const GUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{3,64}$/;

function readSteamSession() {
  const cookieStore = cookies();
  const rawSteam = cookieStore.get('steam_session')?.value;
  try {
    return rawSteam ? decryptJson(rawSteam) : null;
  } catch {
    return null;
  }
}

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

function resolveIdentity(body = {}, steamUser = null) {
  if (steamUser?.steamid) {
    return {
      id: String(steamUser.steamid),
      displayName: sanitizeDisplayName(steamUser.personaname, 'Pilot'),
      identityKind: 'steam',
      authenticated: true,
      steamUser,
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

  const steamUser = readSteamSession();
  const identity = resolveIdentity(body, steamUser);

  if (hasDurableMultiplayer()) {
    const result = await joinDurableRoom({
      roomName,
      identity,
      steamUser: identity.steamUser,
    });
    return NextResponse.json(result, { status: result.status || 200 });
  }

  pruneAuthoritativeRooms();
  const result = joinAuthoritativeRoom({
    roomName,
    identity,
    steamUser: identity.steamUser,
  });
  return NextResponse.json({ ...result, durable: false });
}
