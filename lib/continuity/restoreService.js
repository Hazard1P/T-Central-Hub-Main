import crypto from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { continuityHealthService } from '@/lib/continuity/continuityHealthService';
import { DYSON_CONTINUITY_SCHEMA_VERSION, migrateDysonContinuityState } from '@/lib/dysonContinuity';

const CHECKPOINT_INDEX_FILE = path.join(process.cwd(), 'data', 'continuity-checkpoint.index.json');
const CHECKPOINT_STORE_FILE = path.join(process.cwd(), 'data', 'continuity-checkpoint.store.json');
const RESTORE_AUDIT_FILE = path.join(process.cwd(), 'data', 'continuity-restore.audit.json');
const AUDIT_LIMIT = 500;

const continuityRuntime = globalThis.__dysonContinuityRestoreRuntime || {
  activeState: null,
};

if (!globalThis.__dysonContinuityRestoreRuntime) {
  globalThis.__dysonContinuityRestoreRuntime = continuityRuntime;
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function checksumFor(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function summarizeDiff(before = {}, after = {}) {
  const gateBefore = String(before?.gateStatus || 'unknown');
  const gateAfter = String(after?.gateStatus || 'unknown');
  const ringChanges = [];
  const keys = new Set([...Object.keys(before?.ringHealth || {}), ...Object.keys(after?.ringHealth || {})]);

  for (const key of keys) {
    const prev = before?.ringHealth?.[key]?.status || 'unknown';
    const next = after?.ringHealth?.[key]?.status || 'unknown';
    if (prev !== next) {
      ringChanges.push({ ring: key, before: prev, after: next });
    }
  }

  return {
    gateStatus: { before: gateBefore, after: gateAfter, changed: gateBefore !== gateAfter },
    ringHealthChanges: ringChanges,
  };
}

async function appendAudit(event) {
  const existing = await readJson(RESTORE_AUDIT_FILE, []);
  const next = Array.isArray(existing) ? existing : [];
  next.unshift(event);
  await writeJson(RESTORE_AUDIT_FILE, next.slice(0, AUDIT_LIMIT));
}

export const restoreService = {
  async restore(checkpointId, options = {}) {
    const mode = options?.mode === 'validate_only' ? 'validate_only' : 'apply';
    const now = new Date().toISOString();

    const index = asObject(await readJson(CHECKPOINT_INDEX_FILE, {}));
    const checkpoints = asObject(await readJson(CHECKPOINT_STORE_FILE, {}));
    const record = asObject(index?.checkpoints?.[checkpointId]);
    const checkpoint = asObject(checkpoints?.[checkpointId]);

    if (!record.id || !Object.keys(checkpoint).length) {
      return { ok: false, error: 'CHECKPOINT_NOT_FOUND', checkpointId, mode };
    }

    if (record.checksum !== checksumFor(checkpoint)) {
      return { ok: false, error: 'CHECKPOINT_CHECKSUM_MISMATCH', checkpointId, mode };
    }

    const sourceSchemaVersion = Number.isFinite(Number(checkpoint?.schemaVersion))
      ? Number(checkpoint.schemaVersion)
      : 0;

    const expectedSchemaVersion = options?.expectedSchemaVersion;
    if (Number.isFinite(Number(expectedSchemaVersion)) && Number(expectedSchemaVersion) !== sourceSchemaVersion) {
      return { ok: false, error: 'EXPECTED_SCHEMA_VERSION_MISMATCH', checkpointId, mode, sourceSchemaVersion };
    }

    let normalizedState = checkpoint;
    let migrated = false;

    if (sourceSchemaVersion !== DYSON_CONTINUITY_SCHEMA_VERSION) {
      normalizedState = migrateDysonContinuityState(checkpoint, {
        targetRelease: String(options?.targetRelease || checkpoint?.release || '0.0.0'),
        now,
      });
      migrated = true;
    }

    const runtimeBefore = continuityHealthService.getLatestSnapshot();

    if (mode === 'validate_only') {
      return {
        ok: true,
        mode,
        checkpointId,
        migrated,
        sourceSchemaVersion,
        targetSchemaVersion: DYSON_CONTINUITY_SCHEMA_VERSION,
        diffSummary: summarizeDiff(runtimeBefore, runtimeBefore),
      };
    }

    continuityRuntime.activeState = normalizedState;

    const runtimeAfter = continuityHealthService.evaluate();
    const persistedSnapshot = await continuityHealthService.persistSnapshot(runtimeAfter);

    index.lastKnownGoodCheckpointId = checkpointId;
    await writeJson(CHECKPOINT_INDEX_FILE, index);

    const auditEvent = {
      type: 'continuity_restore_applied',
      checkpointId,
      actor: String(options?.actor || 'system'),
      occurredAt: now,
      mode,
      migrated,
      sourceSchemaVersion,
      targetSchemaVersion: DYSON_CONTINUITY_SCHEMA_VERSION,
    };
    await appendAudit(auditEvent);

    return {
      ok: true,
      mode,
      checkpointId,
      migrated,
      sourceSchemaVersion,
      targetSchemaVersion: DYSON_CONTINUITY_SCHEMA_VERSION,
      persistedSnapshot,
      diffSummary: summarizeDiff(runtimeBefore, runtimeAfter),
      lastKnownGoodCheckpointId: index.lastKnownGoodCheckpointId,
      auditEvent,
    };
  },
};
