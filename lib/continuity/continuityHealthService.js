import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import continuityManifest from '@/data/dyson-continuity.manifest.json';
import progressionManifest from '@/data/dyson-progression.manifest.json';

const SNAPSHOT_FILE = path.join(process.cwd(), 'data', 'continuity-health.snapshots.json');
const SNAPSHOT_LIMIT = 600;
const METERING_INTERVAL_MS = 1000;

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function resolveRingHealth(canonicalSphereIds = []) {
  const ringHealth = {};

  for (const sphereId of canonicalSphereIds) {
    const state = progressionManifest?.spheres?.[sphereId] || {};
    const stateVersion = toFiniteNumber(state.stateVersion, 0);
    const contentDelta = String(state.contentDelta || '').trim();
    const simulationMilestone = String(state.simulationMilestone || '').trim();
    ringHealth[sphereId] = {
      status: stateVersion > 0 && (contentDelta || simulationMilestone) ? 'healthy' : 'degraded',
      stateVersion,
    };
  }

  return ringHealth;
}

function resolveCrossSphereIntegrity(canonicalSphereIds = [], ringHealth = {}) {
  if (canonicalSphereIds.length === 0) return 0;
  const healthyCount = canonicalSphereIds.reduce((count, sphereId) => {
    return ringHealth?.[sphereId]?.status === 'healthy' ? count + 1 : count;
  }, 0);
  return Number((healthyCount / canonicalSphereIds.length).toFixed(3));
}

async function readSnapshots() {
  try {
    const raw = await readFile(SNAPSHOT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeSnapshots(snapshots = []) {
  await mkdir(path.dirname(SNAPSHOT_FILE), { recursive: true });
  await writeFile(SNAPSHOT_FILE, JSON.stringify(snapshots.slice(0, SNAPSHOT_LIMIT), null, 2), 'utf8');
}

class ContinuityHealthService {
  constructor() {
    this.intervalHandle = null;
    this.latestSnapshot = null;
    this.startedAtUnix = null;
  }

  evaluate() {
    const canonicalSphereIds = Array.isArray(continuityManifest?.canonicalSphereIds) ? continuityManifest.canonicalSphereIds : [];
    const ringHealth = resolveRingHealth(canonicalSphereIds);
    const crossSphereIntegrity = resolveCrossSphereIntegrity(canonicalSphereIds, ringHealth);
    const allHealthy = canonicalSphereIds.every((sphereId) => ringHealth?.[sphereId]?.status === 'healthy');

    const snapshot = {
      gateStatus: allHealthy ? 'open' : 'blocked',
      ringHealth,
      crossSphereIntegrity,
      timestampUnix: Math.floor(Date.now() / 1000),
    };

    this.latestSnapshot = snapshot;
    return snapshot;
  }

  async persistSnapshot(snapshot = this.evaluate()) {
    const stored = await readSnapshots();
    stored.unshift(snapshot);
    await writeSnapshots(stored);
    this.latestSnapshot = snapshot;
    return snapshot;
  }

  start() {
    if (this.intervalHandle) {
      return {
        started: true,
        alreadyRunning: true,
        snapshot: this.latestSnapshot || this.evaluate(),
      };
    }

    this.startedAtUnix = Math.floor(Date.now() / 1000);

    const runTick = async () => {
      const snapshot = this.evaluate();
      try {
        await this.persistSnapshot(snapshot);
      } catch {
        this.latestSnapshot = snapshot;
      }
    };

    void runTick();
    this.intervalHandle = setInterval(() => {
      void runTick();
    }, METERING_INTERVAL_MS);

    if (typeof this.intervalHandle?.unref === 'function') {
      this.intervalHandle.unref();
    }

    return {
      started: true,
      alreadyRunning: false,
      snapshot: this.latestSnapshot || this.evaluate(),
    };
  }

  getLatestSnapshot() {
    return this.latestSnapshot || this.evaluate();
  }
}

const continuityHealthService = new ContinuityHealthService();

export { continuityHealthService };
