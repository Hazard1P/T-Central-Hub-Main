import { applyMultiplayerProgressionEvent, buildAccountSnapshot, defaultProgressState, normalizeProgressState } from '@/lib/accountProgression';
import { loadPlayerProgression, persistPlayerProgression } from '@/lib/serverPersistence';

function resolveIdentityFromMultiplayer({ playerId, displayName = 'Pilot' } = {}) {
  const normalizedId = String(playerId || 'guest-server');
  return {
    id: normalizedId,
    displayName,
    kind: normalizedId.startsWith('guest-') ? 'guest' : 'member',
    authenticated: !normalizedId.startsWith('guest-'),
  };
}

export async function awardMultiplayerProgressionEvent({
  playerId,
  roomName,
  eventId,
  trigger,
  sessionId,
  displayName = 'Pilot',
} = {}) {
  if (!playerId || !eventId || !trigger) {
    return { ok: false, status: 400, error: 'INVALID_MULTIPLAYER_PROGRESSION_EVENT', delta: null };
  }

  const identity = resolveIdentityFromMultiplayer({ playerId, displayName });
  const loaded = await loadPlayerProgression(identity);
  const progress = loaded?.record
    ? normalizeProgressState(loaded.record.progress)
    : defaultProgressState();

  const applied = applyMultiplayerProgressionEvent(progress, {
    trigger,
    roomName,
    playerId,
    sessionId,
    eventId,
    occurredAt: Date.now(),
  });

  if (!applied.ok) {
    return {
      ok: false,
      status: 422,
      error: applied.blockedReason || 'PROGRESSION_EVENT_REJECTED',
      delta: applied.delta,
    };
  }

  if (!applied.delta?.applied) {
    return {
      ok: true,
      storage: loaded?.storage || 'none',
      delta: {
        ...applied.delta,
        eventId,
        eventKey: applied.eventKey,
      },
      snapshot: null,
    };
  }

  const snapshot = buildAccountSnapshot({ identity, progress: applied.progress });
  const persisted = await persistPlayerProgression(snapshot);

  return {
    ok: persisted.ok,
    storage: persisted.storage,
    warning: persisted.ok ? null : persisted.reason || 'PLAYER_PROGRESSION_PERSIST_FAILED',
    delta: {
      ...applied.delta,
      eventId,
      eventKey: applied.eventKey,
      savedAt: snapshot.savedAt,
    },
    snapshot: {
      progression: snapshot.progression,
      progress: {
        routeTrips: snapshot.progress.routeTrips,
        seedCount: snapshot.progress.seedCount,
        entropyMined: snapshot.progress.entropyMined,
        entropyResolved: snapshot.progress.entropyResolved,
        credits: snapshot.progress.credits,
        multiplayerJumped: snapshot.progress.multiplayerJumped,
      },
    },
  };
}
