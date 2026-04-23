import { persistDysonMeterEvent } from '@/lib/serverPersistence';

const DEFAULT_TIMEOUT_MS = 1200;
const DEFAULT_RETRY_BUDGET = 1;

function clampNumber(value, fallback = 0, min = -Infinity, max = Infinity) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveAdapterConfig(overrides = {}) {
  return {
    baseUrl: String(overrides.baseUrl || process.env.SYNAPTICS_SECONDS_METER_BASE_URL || '').trim(),
    authToken: String(overrides.authToken || process.env.SYNAPTICS_SECONDS_METER_AUTH_TOKEN || '').trim(),
    timeoutMs: parsePositiveInt(overrides.timeoutMs || process.env.SYNAPTICS_SECONDS_METER_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    retryBudget: parsePositiveInt(overrides.retryBudget || process.env.SYNAPTICS_SECONDS_METER_RETRY_BUDGET, DEFAULT_RETRY_BUDGET),
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timeout);
  }
}

async function executeWithRetry(operation, retryBudget = DEFAULT_RETRY_BUDGET) {
  let lastError = null;
  for (let attempt = 0; attempt <= retryBudget; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('SYNAPTICS_RETRY_EXHAUSTED');
}

function summarizeSnapshot(payload = {}) {
  return {
    meterTick: clampNumber(payload?.meterTick, Date.now(), 0),
    observedEntropy: clampNumber(payload?.observedEntropy, 0, 0, 1e6),
    secondsFlux: clampNumber(payload?.secondsFlux, 0, -1e6, 1e6),
    confidence: clampNumber(payload?.confidence, 0.6, 0, 1),
  };
}

function summarizeSignals(gameplaySignals = {}) {
  return {
    framePressure: clampNumber(gameplaySignals?.framePressure, 0.2, 0, 4),
    conflictLoad: clampNumber(gameplaySignals?.conflictLoad, 0.1, 0, 4),
    playerCount: clampNumber(gameplaySignals?.playerCount, 1, 1, 1000),
  };
}

function buildSafeSnapshot(sessionContext = {}) {
  return {
    source: 'fallback',
    sessionId: String(sessionContext?.sessionId || 'guest-session'),
    capturedAt: new Date().toISOString(),
    meterTick: Date.now(),
    observedEntropy: 0,
    secondsFlux: 0,
    confidence: 0.35,
  };
}

export function createSynapticsSecondsMeterAdapter(options = {}) {
  const config = resolveAdapterConfig(options);

  async function readMeterSnapshot(sessionContext = {}) {
    if (!config.baseUrl) {
      return {
        ok: false,
        degraded: true,
        reason: 'SYNAPTICS_BASE_URL_UNCONFIGURED',
        snapshot: buildSafeSnapshot(sessionContext),
      };
    }

    try {
      const response = await executeWithRetry(
        () => fetchWithTimeout(`${config.baseUrl.replace(/\/$/, '')}/meter/snapshot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {}),
          },
          body: JSON.stringify({ sessionContext }),
        }, config.timeoutMs),
        config.retryBudget
      );

      if (!response.ok) {
        throw new Error(`SYNAPTICS_SNAPSHOT_HTTP_${response.status}`);
      }

      const payload = await response.json();
      return {
        ok: true,
        degraded: false,
        snapshot: {
          source: 'remote',
          sessionId: String(sessionContext?.sessionId || payload?.sessionId || 'guest-session'),
          capturedAt: new Date().toISOString(),
          ...summarizeSnapshot(payload),
        },
      };
    } catch (error) {
      return {
        ok: false,
        degraded: true,
        reason: error?.message || 'SYNAPTICS_SNAPSHOT_FAILED',
        snapshot: buildSafeSnapshot(sessionContext),
      };
    }
  }

  function computeDiscrepancy(snapshot = {}, gameplaySignals = {}) {
    const normalizedSnapshot = summarizeSnapshot(snapshot);
    const normalizedSignals = summarizeSignals(gameplaySignals);
    const expectedEntropy = Number((normalizedSignals.framePressure * 12 + normalizedSignals.conflictLoad * 8 + normalizedSignals.playerCount * 0.03).toFixed(6));
    const discrepancy = Number((normalizedSnapshot.observedEntropy - expectedEntropy).toFixed(6));
    const entropyBudget = Number(Math.max(0, (Math.abs(discrepancy) + Math.abs(normalizedSnapshot.secondsFlux)) * normalizedSnapshot.confidence).toFixed(6));

    return {
      expectedEntropy,
      discrepancy,
      entropyBudget,
      severity: Math.abs(discrepancy) > 10 ? 'high' : Math.abs(discrepancy) > 4 ? 'medium' : 'low',
      signals: normalizedSignals,
    };
  }

  async function commitEntropyDistribution(distributionRecord = {}) {
    const persisted = await persistDysonMeterEvent(distributionRecord);

    if (!config.baseUrl) {
      return {
        ok: persisted.ok,
        degraded: true,
        storage: persisted.storage,
        reason: persisted.reason || 'SYNAPTICS_BASE_URL_UNCONFIGURED',
      };
    }

    try {
      await executeWithRetry(
        () => fetchWithTimeout(`${config.baseUrl.replace(/\/$/, '')}/meter/distribution`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {}),
          },
          body: JSON.stringify(distributionRecord),
        }, config.timeoutMs),
        config.retryBudget
      );

      return {
        ok: persisted.ok,
        degraded: false,
        storage: persisted.storage,
      };
    } catch (error) {
      return {
        ok: persisted.ok,
        degraded: true,
        storage: persisted.storage,
        reason: error?.message || 'SYNAPTICS_DISTRIBUTION_WRITE_FAILED',
      };
    }
  }

  return {
    config,
    readMeterSnapshot,
    computeDiscrepancy,
    commitEntropyDistribution,
  };
}

export async function runRing1Reconciliation({ sessionContext = {}, gameplaySignals = {}, adapter = createSynapticsSecondsMeterAdapter() } = {}) {
  const snapshotResult = await adapter.readMeterSnapshot(sessionContext);
  const discrepancy = adapter.computeDiscrepancy(snapshotResult.snapshot, gameplaySignals);

  const distributionRecord = {
    session_id: String(sessionContext?.sessionId || 'guest-session'),
    lobby_mode: String(sessionContext?.lobbyMode || 'hub'),
    captured_at: snapshotResult.snapshot?.capturedAt || new Date().toISOString(),
    meter_snapshot: snapshotResult.snapshot,
    gameplay_signals: discrepancy.signals,
    discrepancy: discrepancy.discrepancy,
    entropy_budget: discrepancy.entropyBudget,
    outputs: {
      storage: Number((discrepancy.entropyBudget * 0.45).toFixed(6)),
      dispersal: Number((discrepancy.entropyBudget * 0.35).toFixed(6)),
      generation: Number((discrepancy.entropyBudget * 0.2).toFixed(6)),
    },
    degraded: Boolean(snapshotResult.degraded),
    degraded_reason: snapshotResult.reason || null,
    generated_at: new Date().toISOString(),
  };

  const commitResult = await adapter.commitEntropyDistribution(distributionRecord);

  return {
    ok: Boolean(snapshotResult.snapshot) && Boolean(commitResult.ok),
    degraded: Boolean(snapshotResult.degraded || commitResult.degraded),
    reason: snapshotResult.reason || commitResult.reason || null,
    snapshot: snapshotResult.snapshot,
    discrepancy,
    distribution: distributionRecord.outputs,
    persistence: {
      ok: Boolean(commitResult.ok),
      storage: commitResult.storage || 'none',
    },
  };
}
