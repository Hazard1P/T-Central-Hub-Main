export const ACCOUNT_PROGRESS_VERSION = 1;

export const MULTIPLAYER_PROGRESSION_RULES = {
  triggerRewards: {
    first_join: { routeTrips: 1, multiplayerJumped: true },
    objective_participation: { seedCount: 1 },
    combat_contribution: { entropyMined: 1 },
    session_completion: { entropyResolved: 1, credits: 12 },
  },
  capsPerSession: {
    first_join: 1,
    objective_participation: 4,
    combat_contribution: 12,
    session_completion: 1,
  },
  cooldownMs: {
    first_join: 0,
    objective_participation: 4_000,
    combat_contribution: 1_200,
    session_completion: 0,
  },
  maxProcessedEvents: 320,
  maxSessionBuckets: 24,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeProcessedEvents(input) {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map((value) => String(value || '').trim()).filter(Boolean))]
    .slice(-MULTIPLAYER_PROGRESSION_RULES.maxProcessedEvents);
}

function normalizeSessionCounters(input = {}) {
  const source = typeof input === 'object' && input ? input : {};
  const entries = Object.entries(source)
    .slice(-MULTIPLAYER_PROGRESSION_RULES.maxSessionBuckets)
    .map(([sessionKey, counters]) => {
      const current = typeof counters === 'object' && counters ? counters : {};
      return [String(sessionKey), {
        first_join: Number(current.first_join || 0),
        objective_participation: Number(current.objective_participation || 0),
        combat_contribution: Number(current.combat_contribution || 0),
        session_completion: Number(current.session_completion || 0),
        lastAwardAt: Number(current.lastAwardAt || 0),
      }];
    });
  return Object.fromEntries(entries);
}

function normalizeMultiplayerMeta(input = {}) {
  const source = typeof input === 'object' && input ? input : {};
  return {
    processedEventIds: sanitizeProcessedEvents(source.processedEventIds),
    sessionCounters: normalizeSessionCounters(source.sessionCounters),
  };
}

export function getAccountStorageKey(identityId = 'guest-server') {
  return `tcentral_account_progress_${identityId}`;
}

export function defaultProgressState() {
  return {
    visitedNodes: ['deep_blackhole'],
    routeTrips: 0,
    seedCount: 0,
    entropyMined: 0,
    entropyResolved: 0,
    credits: 0,
    multiplayerJumped: false,
    vipTier: 'standard',
    vipXpBoost: 0,
    multiplayerMeta: normalizeMultiplayerMeta(),
  };
}

export function normalizeProgressState(input = {}, fallback = defaultProgressState()) {
  return {
    visitedNodes: Array.isArray(input.visitedNodes) && input.visitedNodes.length ? [...new Set(input.visitedNodes.map(String))] : fallback.visitedNodes,
    routeTrips: Number.isFinite(Number(input.routeTrips)) ? Number(input.routeTrips) : fallback.routeTrips,
    seedCount: Number.isFinite(Number(input.seedCount)) ? Number(input.seedCount) : fallback.seedCount,
    entropyMined: Number.isFinite(Number(input.entropyMined)) ? Number(input.entropyMined) : fallback.entropyMined,
    entropyResolved: Number.isFinite(Number(input.entropyResolved)) ? Number(input.entropyResolved) : fallback.entropyResolved,
    credits: Number.isFinite(Number(input.credits)) ? Number(input.credits) : fallback.credits,
    multiplayerJumped: typeof input.multiplayerJumped === 'boolean' ? input.multiplayerJumped : fallback.multiplayerJumped,
    vipTier: typeof input.vipTier === 'string' ? input.vipTier : fallback.vipTier,
    vipXpBoost: Number.isFinite(Number(input.vipXpBoost)) ? clamp(Number(input.vipXpBoost), 0, 0.35) : fallback.vipXpBoost,
    multiplayerMeta: normalizeMultiplayerMeta(input.multiplayerMeta),
  };
}

function resolveEventKey({ roomName = 'default-room', playerId = 'guest-server', eventId } = {}) {
  return `${String(roomName || 'default-room')}:${String(playerId || 'guest-server')}:${String(eventId || '')}`;
}

function resolveSessionKey({ roomName = 'default-room', sessionId = 'default-session' } = {}) {
  return `${String(roomName || 'default-room')}:${String(sessionId || 'default-session')}`;
}

function resolveTriggerRewards(trigger = '') {
  return MULTIPLAYER_PROGRESSION_RULES.triggerRewards[trigger] || null;
}

export function applyMultiplayerProgressionEvent(progress = defaultProgressState(), event = {}) {
  const normalized = normalizeProgressState(progress);
  const trigger = String(event?.trigger || '').trim();
  const rewards = resolveTriggerRewards(trigger);
  const eventId = String(event?.eventId || '').trim();
  const roomName = String(event?.roomName || 'default-room');
  const playerId = String(event?.playerId || 'guest-server');
  const sessionId = String(event?.sessionId || 'default-session');
  const now = Number(event?.occurredAt || Date.now());

  if (!rewards || !eventId) {
    return {
      ok: false,
      duplicate: false,
      blockedReason: 'INVALID_TRIGGER_OR_EVENT_ID',
      eventKey: resolveEventKey({ roomName, playerId, eventId }),
      progress: normalized,
      delta: null,
    };
  }

  const eventKey = resolveEventKey({ roomName, playerId, eventId });
  if (normalized.multiplayerMeta.processedEventIds.includes(eventKey)) {
    return {
      ok: true,
      duplicate: true,
      blockedReason: null,
      eventKey,
      progress: normalized,
      delta: {
        trigger,
        duplicate: true,
        blockedReason: null,
        applied: false,
        gained: {},
      },
    };
  }

  const sessionKey = resolveSessionKey({ roomName, sessionId });
  const currentCounters = normalized.multiplayerMeta.sessionCounters[sessionKey] || {
    first_join: 0,
    objective_participation: 0,
    combat_contribution: 0,
    session_completion: 0,
    lastAwardAt: 0,
  };

  const triggerCap = Number(MULTIPLAYER_PROGRESSION_RULES.capsPerSession[trigger] || 0);
  const triggerCooldown = Number(MULTIPLAYER_PROGRESSION_RULES.cooldownMs[trigger] || 0);
  const sessionCounter = Number(currentCounters?.[trigger] || 0);

  if (triggerCap > 0 && sessionCounter >= triggerCap) {
    return {
      ok: true,
      duplicate: false,
      blockedReason: 'CAP_REACHED',
      eventKey,
      progress: normalized,
      delta: {
        trigger,
        duplicate: false,
        blockedReason: 'CAP_REACHED',
        applied: false,
        gained: {},
      },
    };
  }

  if (triggerCooldown > 0 && now - Number(currentCounters.lastAwardAt || 0) < triggerCooldown) {
    return {
      ok: true,
      duplicate: false,
      blockedReason: 'COOLDOWN_ACTIVE',
      eventKey,
      progress: normalized,
      delta: {
        trigger,
        duplicate: false,
        blockedReason: 'COOLDOWN_ACTIVE',
        applied: false,
        gained: {},
      },
    };
  }

  const before = deriveProgression(normalized);
  const next = normalizeProgressState({
    ...normalized,
    routeTrips: normalized.routeTrips + Number(rewards.routeTrips || 0),
    seedCount: normalized.seedCount + Number(rewards.seedCount || 0),
    entropyMined: normalized.entropyMined + Number(rewards.entropyMined || 0),
    entropyResolved: normalized.entropyResolved + Number(rewards.entropyResolved || 0),
    credits: normalized.credits + Number(rewards.credits || 0),
    multiplayerJumped: rewards.multiplayerJumped ? true : normalized.multiplayerJumped,
    multiplayerMeta: {
      processedEventIds: [...normalized.multiplayerMeta.processedEventIds, eventKey].slice(-MULTIPLAYER_PROGRESSION_RULES.maxProcessedEvents),
      sessionCounters: {
        ...normalized.multiplayerMeta.sessionCounters,
        [sessionKey]: {
          ...currentCounters,
          [trigger]: sessionCounter + 1,
          lastAwardAt: now,
        },
      },
    },
  });
  const after = deriveProgression(next);

  return {
    ok: true,
    duplicate: false,
    blockedReason: null,
    eventKey,
    progress: next,
    delta: {
      trigger,
      duplicate: false,
      blockedReason: null,
      applied: true,
      gained: rewards,
      xpDelta: after.xp - before.xp,
      levelDelta: after.level - before.level,
      xp: after.xp,
      level: after.level,
      title: after.title,
    },
  };
}

export function deriveProgression(progress = defaultProgressState()) {
  const safe = normalizeProgressState(progress);
  const explorationXp = safe.visitedNodes.length * 14;
  const routingXp = safe.routeTrips * 20;
  const seedXp = safe.seedCount * 18;
  const miningXp = safe.entropyMined * 6;
  const settlementXp = safe.entropyResolved * 10;
  const scalarXp = Math.round(safe.credits * 1.8);
  const sharedHubBonus = safe.multiplayerJumped ? 44 : 0;
  const baseXp = explorationXp + routingXp + seedXp + miningXp + settlementXp + scalarXp + sharedHubBonus;
  const vipXpBonus = Math.round(baseXp * safe.vipXpBoost);
  const xp = baseXp + vipXpBonus;
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 44)) + 1);
  const nextLevelXp = level * level * 44;
  const previousLevelXp = Math.max(0, (level - 1) * (level - 1) * 44);
  const progressToNext = clamp((xp - previousLevelXp) / Math.max(1, nextLevelXp - previousLevelXp), 0, 1);
  const titles = ['Cadet', 'Navigator', 'Surveyor', 'Entropic Pilot', 'Singularity Pilot', 'Epoch Captain', 'Dyson Marshal', 'Foundation Vector', 'Central Warden'];
  const title = titles[Math.min(titles.length - 1, level - 1)] || titles[titles.length - 1];
  return {
    version: ACCOUNT_PROGRESS_VERSION,
    xp,
    level,
    title,
    nextLevelXp,
    previousLevelXp,
    progressToNext,
    stats: {
      explorationXp,
      routingXp,
      seedXp,
      miningXp,
      settlementXp,
      scalarXp,
      sharedHubBonus,
      vipXpBonus,
    },
    access: {
      vipTier: safe.vipTier,
      vipXpBoost: safe.vipXpBoost,
    },
  };
}

export function buildAccountSnapshot({ identity = null, steamUser = null, progress = defaultProgressState(), savedAt = null } = {}) {
  const normalized = normalizeProgressState(progress);
  const progression = deriveProgression(normalized);
  return {
    version: ACCOUNT_PROGRESS_VERSION,
    identity: {
      id: String(identity?.id || steamUser?.steamid || 'guest-server'),
      displayName: identity?.displayName || steamUser?.personaname || 'Guest Pilot',
      kind: identity?.kind || (steamUser?.steamid ? 'steam' : 'guest'),
      authenticated: Boolean(identity?.authenticated || steamUser?.steamid),
    },
    progress: normalized,
    progression,
    savedAt: savedAt || new Date().toISOString(),
  };
}
