function toSafeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function buildContinuityEnvelope(ring1 = {}) {
  const status = ring1?.status || 'skipped';
  return {
    status,
    ring1,
  };
}

export async function attachRing1Continuity(payload = {}, {
  roomName,
  playerId,
  sessionToken,
  requestedMode,
  source = 'unknown',
  actionType,
  runReconciliation,
} = {}) {
  const basePayload = payload && typeof payload === 'object' ? payload : {};
  const state = basePayload?.state || {};

  if (!basePayload.modeChanged) {
    const ring1 = {
      status: 'skipped',
      degraded: false,
      reason: 'HANDOFF_NOT_COMMITTED',
    };
    return {
      ...basePayload,
      continuity: buildContinuityEnvelope(ring1),
    };
  }

  if (typeof runReconciliation !== 'function') {
    const ring1 = {
      status: 'degraded',
      degraded: true,
      reason: 'RING1_RECONCILIATION_UNAVAILABLE',
      persistence: { ok: false, storage: 'none' },
    };
    return {
      ...basePayload,
      continuity: buildContinuityEnvelope(ring1),
    };
  }

  const sessionContext = {
    roomName: String(roomName || state?.roomName || 'tcentral-main'),
    sessionId: String(sessionToken || playerId || state?.sessionId || 'guest-session'),
    playerId: String(playerId || 'guest-player'),
    lobbyMode: String(requestedMode || basePayload?.mode || state?.mode || 'multi_player'),
    source,
    actionType: actionType ? String(actionType) : undefined,
  };

  const gameplaySignals = {
    playerCount: toSafeNumber(state?.playerCount, 1),
    framePressure: toSafeNumber((state?.projectiles || []).length, 0),
    conflictLoad: toSafeNumber(state?.world?.combatHeat, 0),
  };

  try {
    const reconciliation = await runReconciliation({ sessionContext, gameplaySignals });
    const ring1 = {
      status: reconciliation?.degraded ? 'degraded' : 'ok',
      degraded: Boolean(reconciliation?.degraded),
      reason: reconciliation?.reason || null,
      persistence: reconciliation?.persistence || { ok: false, storage: 'none' },
    };

    return {
      ...basePayload,
      continuity: buildContinuityEnvelope(ring1),
    };
  } catch (error) {
    const ring1 = {
      status: 'degraded',
      degraded: true,
      reason: error?.message || 'RING1_RECONCILIATION_FAILED',
      persistence: { ok: false, storage: 'none' },
    };

    return {
      ...basePayload,
      continuity: buildContinuityEnvelope(ring1),
    };
  }
}
