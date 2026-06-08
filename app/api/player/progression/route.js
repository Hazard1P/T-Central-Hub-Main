import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { buildAccountSnapshot, defaultProgressState, isOlderProgressSnapshot, normalizeProgressState } from '@/lib/accountProgression';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';
import { loadPlayerProgression, persistPlayerProgression } from '@/lib/serverPersistence';

function buildScopedAccountId(provider, accountId) {
  if (!provider || !accountId) return null;
  return `${String(provider).toLowerCase()}:${String(accountId)}`;
}

function resolveIdentity(rawIdentity = null, authContext = null) {
  if (authContext?.authenticated && authContext.provider && authContext.accountId) {
    return {
      id: buildScopedAccountId(authContext.provider, authContext.accountId),
      displayName: authContext.displayName || 'Linked Pilot',
      kind: authContext.identityKind || authContext.provider,
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

function resolveAuthenticatedSession() {
  return resolveGameAuthContext(cookies());
}

export async function GET(request) {
  const authContext = resolveAuthenticatedSession();
  const { searchParams } = new URL(request.url);
  const rawIdentity = {
    id: searchParams.get('id'),
    displayName: searchParams.get('displayName'),
    kind: searchParams.get('kind') || 'guest',
    authenticated: searchParams.get('authenticated') === 'true',
  };
  const identity = resolveIdentity(rawIdentity, authContext);
  const loaded = await loadPlayerProgression(identity);
  const snapshot = loaded?.record
    ? buildAccountSnapshot({ identity, steamUser: authContext.steamUser, progress: normalizeProgressState(loaded.record.progress), savedAt: loaded.record.savedAt })
    : buildAccountSnapshot({ identity, steamUser: authContext.steamUser, progress: defaultProgressState() });

  return NextResponse.json({ ok: true, snapshot, storage: loaded?.storage || 'local-default' });
}

export async function POST(request) {
  const authContext = resolveAuthenticatedSession();
  const body = await request.json().catch(() => null);
  const identity = resolveIdentity(body?.identity, authContext);
  const snapshot = buildAccountSnapshot({ identity, steamUser: authContext.steamUser, progress: normalizeProgressState(body?.progress), savedAt: body?.savedAt });
  const loaded = await loadPlayerProgression(identity);
  const currentSnapshot = loaded?.record
    ? buildAccountSnapshot({ identity, steamUser: authContext.steamUser, progress: normalizeProgressState(loaded.record.progress), savedAt: loaded.record.savedAt })
    : null;

  if (currentSnapshot && isOlderProgressSnapshot(snapshot, currentSnapshot)) {
    return NextResponse.json({
      ok: false,
      error: 'STALE_PROGRESSION_SNAPSHOT',
      snapshot: currentSnapshot,
      storage: loaded?.storage || 'none',
      warning: 'Ignored an older progression snapshot to preserve hydrated account progress.',
    }, { status: 409 });
  }

  const persisted = await persistPlayerProgression(snapshot, {
    eventType: 'PROGRESSION_SNAPSHOT_SAVED',
    ledgerMetadata: { provider: identity.kind, source: 'player_progression_api' },
  });

  return NextResponse.json({
    ok: persisted.ok,
    snapshot,
    storage: persisted.storage,
    ledgerStorage: persisted.ledger?.storage || null,
    warning: persisted.ok ? null : 'Durable account persistence is not configured; client fallback remains active.',
  }, { status: persisted.ok ? 200 : 202 });
}
