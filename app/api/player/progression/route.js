import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decryptJson } from '@/lib/security';
import { buildAccountSnapshot, defaultProgressState, normalizeProgressState } from '@/lib/accountProgression';
import { loadPlayerProgression, persistPlayerProgression } from '@/lib/serverPersistence';

function resolveIdentity(rawIdentity = null, steamUser = null) {
  if (steamUser?.steamid) {
    return {
      id: String(steamUser.steamid),
      displayName: steamUser.personaname || 'Steam Pilot',
      kind: 'steam',
      authenticated: true,
    };
  }
  return {
    id: String(rawIdentity?.id || 'guest-server'),
    displayName: rawIdentity?.displayName || 'Guest Pilot',
    kind: rawIdentity?.kind || 'guest',
    authenticated: Boolean(rawIdentity?.authenticated),
  };
}

async function resolveSteamUser() {
  const cookieStore = cookies();
  const raw = cookieStore.get('steam_session')?.value;
  try {
    return raw ? decryptJson(raw) : null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  const steamUser = await resolveSteamUser();
  const { searchParams } = new URL(request.url);
  const rawIdentity = {
    id: searchParams.get('id'),
    displayName: searchParams.get('displayName'),
    kind: searchParams.get('kind') || 'guest',
    authenticated: searchParams.get('authenticated') === 'true',
  };
  const identity = resolveIdentity(rawIdentity, steamUser);
  const loaded = await loadPlayerProgression(identity);
  const snapshot = loaded?.record
    ? buildAccountSnapshot({ identity, steamUser, progress: normalizeProgressState(loaded.record.progress), savedAt: loaded.record.savedAt })
    : buildAccountSnapshot({ identity, steamUser, progress: defaultProgressState() });

  return NextResponse.json({ ok: true, snapshot, storage: loaded?.storage || 'local-default' });
}

export async function POST(request) {
  const steamUser = await resolveSteamUser();
  const body = await request.json().catch(() => null);
  const identity = resolveIdentity(body?.identity, steamUser);
  const snapshot = buildAccountSnapshot({ identity, steamUser, progress: normalizeProgressState(body?.progress) });
  const persisted = await persistPlayerProgression(snapshot);

  return NextResponse.json({
    ok: persisted.ok,
    snapshot,
    storage: persisted.storage,
    warning: persisted.ok ? null : 'Durable account persistence is not configured; client fallback remains active.',
  }, { status: persisted.ok ? 200 : 202 });
}
