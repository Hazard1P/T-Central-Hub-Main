import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeState(input = {}) {
  return {
    stateVersion: Number.isFinite(Number(input.stateVersion)) ? Number(input.stateVersion) : 0,
    lastMilestone: typeof input.lastMilestone === 'string' ? input.lastMilestone : 'uninitialized',
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : null,
  };
}

const continuity = JSON.parse(await fs.readFile(path.join(root, 'data', 'dyson-continuity.manifest.json'), 'utf8'));
const raw = JSON.parse(await fs.readFile(path.join(root, 'data', 'dyson-state.snapshot.v3.json'), 'utf8'));
const now = new Date().toISOString();

const next = {
  schemaVersion: 5,
  release: '1.1.0',
  states: {},
  migratedFromSchema: Number(raw?.schemaVersion || 0),
  rollbackSafe: Number(raw?.schemaVersion || 0) <= 5,
};

const stateKeys = [
  ...(continuity.canonicalSphereIds || []).map((id) => continuity?.spheres?.[id]?.stateKey),
  ...(continuity.canonicalBlackholeServerIds || []).map((id) => continuity?.blackholeServers?.[id]?.stateKey),
].filter(Boolean);

for (const stateKey of stateKeys) {
  next.states[stateKey] = {
    ...normalizeState(asObject(raw?.states)?.[stateKey] || asObject(raw?.spheres)?.[stateKey]),
    updatedAt: now,
  };
}

const targetPath = path.join(root, 'data', 'dyson-state.snapshot.v4.json');
await fs.writeFile(targetPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
console.log(`Wrote migrated continuity snapshot: ${path.relative(root, targetPath)}`);
