const SESSION_MODES = Object.freeze({
  IDLE: 'idle',
  SINGLE_PLAYER: 'single_player',
  MULTI_PLAYER: 'multi_player',
});

const RING_ADJUSTMENT_DEFAULTS = Object.freeze({
  ringOneScale: 0.3,
  ringTwoScale: 0.28,
  ringThreeSpinIntensity: 0,
  ringThreePulse: 0.12,
  playerCountSignal: 0,
  eventThroughputSignal: 0,
  combatHeatSignal: 0,
  intensity: 0,
  decayRate: 0.12,
  updatedAt: 0,
});

function clampNumber(value, fallback = 0, min = 0, max = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function getModeStore() {
  if (!globalThis.__TCENTRAL_SESSION_MODE_STORE__) {
    globalThis.__TCENTRAL_SESSION_MODE_STORE__ = new Map();
  }
  return globalThis.__TCENTRAL_SESSION_MODE_STORE__;
}

export function normalizeSessionMode(value, fallback = SESSION_MODES.IDLE) {
  if (!value) return fallback;
  const mode = String(value).trim().toLowerCase();
  if (mode === SESSION_MODES.IDLE || mode === SESSION_MODES.SINGLE_PLAYER || mode === SESSION_MODES.MULTI_PLAYER) return mode;
  if (mode === 'private' || mode === 'single') return SESSION_MODES.SINGLE_PLAYER;
  if (mode === 'hub' || mode === 'multi') return SESSION_MODES.MULTI_PLAYER;
  return fallback;
}

export function transitionSessionMode({ roomName = 'tcentral-main', to = SESSION_MODES.IDLE, source = 'state', changedAt = Date.now() } = {}) {
  const store = getModeStore();
  const key = String(roomName || 'tcentral-main');
  const nextMode = normalizeSessionMode(to, SESSION_MODES.IDLE);
  const existing = store.get(key) || {
    mode: SESSION_MODES.IDLE,
    transition: { from: SESSION_MODES.IDLE, to: SESSION_MODES.IDLE, changedAt: 0, source: 'init' },
    metrics: { ringAdjustments: { ...RING_ADJUSTMENT_DEFAULTS } },
    updatedAt: 0,
  };

  const modeChanged = existing.mode !== nextMode;
  const transition = modeChanged
    ? { from: existing.mode, to: nextMode, changedAt, source }
    : { ...(existing.transition || {}), from: existing.mode, to: nextMode, changedAt: existing.transition?.changedAt || changedAt, source: existing.transition?.source || source };

  const next = {
    ...existing,
    mode: nextMode,
    transition,
    updatedAt: changedAt,
  };
  store.set(key, next);

  return {
    mode: nextMode,
    transition,
    changed: modeChanged,
  };
}

export function buildRingAdjustmentOutputs({ roomName = 'tcentral-main', mode = SESSION_MODES.IDLE, playerCount = 0, eventThroughput = 0, combatHeat = 0, now = Date.now() } = {}) {
  const store = getModeStore();
  const key = String(roomName || 'tcentral-main');
  const existing = store.get(key) || {
    mode: SESSION_MODES.IDLE,
    transition: { from: SESSION_MODES.IDLE, to: SESSION_MODES.IDLE, changedAt: 0, source: 'init' },
    metrics: { ringAdjustments: { ...RING_ADJUSTMENT_DEFAULTS } },
    updatedAt: 0,
  };
  const previous = existing.metrics?.ringAdjustments || { ...RING_ADJUSTMENT_DEFAULTS };

  const safeMode = normalizeSessionMode(mode, existing.mode || SESSION_MODES.IDLE);
  const playerCountSignal = clampNumber(Number(playerCount) / 12, 0, 0, 1);
  const eventThroughputSignal = clampNumber(Number(eventThroughput) / 20, 0, 0, 1);
  const combatHeatSignal = clampNumber(Number(combatHeat) / 100, 0, 0, 1);
  const intensity = clampNumber((playerCountSignal * 0.42) + (eventThroughputSignal * 0.25) + (combatHeatSignal * 0.33), 0, 0, 1);

  const decayRate = safeMode === SESSION_MODES.MULTI_PLAYER ? 0.24 : 0.12;
  const targetRingThree = safeMode === SESSION_MODES.MULTI_PLAYER ? intensity : 0;
  const ringThreeSpinIntensity = Number((previous.ringThreeSpinIntensity + (targetRingThree - previous.ringThreeSpinIntensity) * decayRate).toFixed(4));

  const ringAdjustments = {
    ringOneScale: Number((0.3 + intensity * 0.28).toFixed(4)),
    ringTwoScale: Number((0.28 + intensity * 0.34).toFixed(4)),
    ringThreeSpinIntensity,
    ringThreePulse: Number((0.12 + intensity * 0.62).toFixed(4)),
    playerCountSignal: Number(playerCountSignal.toFixed(4)),
    eventThroughputSignal: Number(eventThroughputSignal.toFixed(4)),
    combatHeatSignal: Number(combatHeatSignal.toFixed(4)),
    intensity: Number(intensity.toFixed(4)),
    decayRate,
    updatedAt: now,
  };

  store.set(key, {
    ...existing,
    mode: safeMode,
    metrics: {
      ...(existing.metrics || {}),
      ringAdjustments,
    },
    updatedAt: now,
  });

  return ringAdjustments;
}

export function getSessionModeSnapshot(roomName = 'tcentral-main') {
  const key = String(roomName || 'tcentral-main');
  const room = getModeStore().get(key);
  return {
    mode: room?.mode || SESSION_MODES.IDLE,
    transition: room?.transition || { from: SESSION_MODES.IDLE, to: SESSION_MODES.IDLE, changedAt: 0, source: 'init' },
    ringAdjustments: room?.metrics?.ringAdjustments || { ...RING_ADJUSTMENT_DEFAULTS },
  };
}

export { SESSION_MODES, RING_ADJUSTMENT_DEFAULTS };
