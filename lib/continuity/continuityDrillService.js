import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const REPORT_FILE = path.join(process.cwd(), 'public', 'reports', 'continuity-drill-latest.json');
const CHECKPOINT_DIR = path.join(process.cwd(), 'data');
const CHECKPOINT_PATTERN = /^dyson-state\.snapshot\..+\.json$/;
const DEFAULT_TARGET_RPO_SECONDS = 24 * 60 * 60;
const DEFAULT_TARGET_RTO_MS = 3000;

function toFiniteNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function validateSchema(payload) {
  if (!payload || typeof payload !== 'object') return { valid: false, reason: 'checkpoint_not_object' };
  if (!Number.isFinite(Number(payload.schemaVersion))) return { valid: false, reason: 'schema_version_invalid' };
  if (!payload.spheres || typeof payload.spheres !== 'object') return { valid: false, reason: 'spheres_missing' };
  return { valid: true };
}

async function fetchLatestDurableCheckpoint() {
  const files = await readdir(CHECKPOINT_DIR, { withFileTypes: true });
  const candidates = files.filter((entry) => entry.isFile() && CHECKPOINT_PATTERN.test(entry.name));

  if (candidates.length === 0) {
    throw new Error('No durable checkpoint files found in data/.');
  }

  const stats = await Promise.all(candidates.map(async (entry) => {
    const fullPath = path.join(CHECKPOINT_DIR, entry.name);
    const stat = await import('node:fs/promises').then((m) => m.stat(fullPath));
    return { fullPath, name: entry.name, mtimeMs: stat.mtimeMs };
  }));

  stats.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const latest = stats[0];
  const contents = await readFile(latest.fullPath, 'utf8');
  return {
    ...latest,
    contents,
    payload: JSON.parse(contents),
  };
}

async function runContinuityDrill(options = {}) {
  const startedAtMs = Date.now();
  const targetRpoSeconds = toFiniteNumber(options.targetRpoSeconds ?? process.env.TARGET_RPO_SECONDS, DEFAULT_TARGET_RPO_SECONDS);
  const targetRtoMs = toFiniteNumber(options.targetRtoMs ?? process.env.TARGET_RTO_MS, DEFAULT_TARGET_RTO_MS);

  const latest = await fetchLatestDurableCheckpoint();
  const checkpointAgeSeconds = Math.floor((startedAtMs - latest.mtimeMs) / 1000);
  const checksum = createHash('sha256').update(latest.contents).digest('hex');
  const schemaValidation = validateSchema(latest.payload);

  const restoreStart = Date.now();
  let restored = null;
  let restoreError = null;

  try {
    restored = JSON.parse(latest.contents);
  } catch (error) {
    restoreError = error instanceof Error ? error.message : 'restore_parse_failed';
  }

  const restoreValidationMs = Date.now() - restoreStart;

  const checks = {
    checkpointWithinRpo: checkpointAgeSeconds <= targetRpoSeconds,
    schemaValid: schemaValidation.valid,
    dryRunRestorePassed: restoreError === null,
    restoreWithinRto: restoreValidationMs <= targetRtoMs,
  };

  const result = Object.values(checks).every(Boolean) ? 'pass' : 'fail';

  const report = {
    generatedAt: new Date(startedAtMs).toISOString(),
    checkpoint: {
      file: path.relative(process.cwd(), latest.fullPath),
      modifiedAt: new Date(latest.mtimeMs).toISOString(),
      checksumSha256: checksum,
      schemaVersion: Number(latest.payload?.schemaVersion ?? NaN),
      sphereCount: Object.keys(restored?.spheres || {}).length,
    },
    targetRpoSeconds,
    targetRtoMs,
    checkpointAgeSeconds,
    restoreValidationMs,
    result,
    checks,
    errors: [schemaValidation.valid ? null : schemaValidation.reason, restoreError].filter(Boolean),
  };

  await mkdir(path.dirname(REPORT_FILE), { recursive: true });
  await writeFile(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');
  return report;
}

async function readLatestContinuityDrillReport() {
  try {
    const raw = await readFile(REPORT_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export { runContinuityDrill, readLatestContinuityDrillReport, REPORT_FILE };
