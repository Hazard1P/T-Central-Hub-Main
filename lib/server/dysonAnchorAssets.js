import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { WORLD_LAYOUT } from '@/lib/worldLayout';

const DATA_DIR = path.join(process.cwd(), 'data');
const ASSET_STORE_FILE = 'dyson-anchor-assets.json';
const ASSET_STORE_PATH = path.join(DATA_DIR, ASSET_STORE_FILE);

const DEFAULT_RING_FACTORS = Object.freeze({
  csis: { ring1: 0.72, ring2: 0.66, ring3: 0.58 },
  ss: { ring1: 0.74, ring2: 0.68, ring3: 0.82 },
  affiliates: { ring1: 0.5, ring2: 0.5, ring3: 0.5 },
});

const DEFAULT_ENCRYPTION_FACTORS = Object.freeze({
  csis: 0.9,
  ss: 0.86,
  affiliates: 0.42,
});

export const DYSON_ASSET_PARAMETER_RANGES = Object.freeze({
  ringFactors: { min: 0, max: 1 },
  encryptionFactor: { min: 0, max: 1 },
});

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildDefaultDysonAssets() {
  return WORLD_LAYOUT
    .filter((node) => node.kind === 'dyson')
    .map((node) => ({
      sphere_key: node.key,
      label: node.label,
      address: node.address,
      description: node.description,
      position: node.position,
      color: node.color,
      priority: node.priority,
      tags: node.tags || [],
      dysonProfile: node.dysonProfile || null,
      networkRole: node.networkRole || null,
      foundationBuilt: Boolean(node.foundationBuilt),
      systemOwned: Boolean(node.systemOwned),
      playerInteractive: node.playerInteractive ?? true,
      playerBuildable: node.playerBuildable ?? true,
      ring_factors: DEFAULT_RING_FACTORS[node.key] || { ring1: 0.5, ring2: 0.5, ring3: 0.5 },
      encryption_factor: DEFAULT_ENCRYPTION_FACTORS[node.key] ?? 0.5,
      staticDefault: true,
    }));
}

export function listDefaultDysonAssets() {
  return cloneJson(buildDefaultDysonAssets());
}

export function getDefaultDysonAssetMap() {
  return new Map(listDefaultDysonAssets().map((asset) => [asset.sphere_key, asset]));
}

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function readDysonAssetOverrides() {
  try {
    const raw = await readFile(ASSET_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

export async function writeDysonAssetOverrides(overrides) {
  await ensureDataDir();
  await writeFile(ASSET_STORE_PATH, `${JSON.stringify(overrides, null, 2)}\n`, 'utf8');
  return { ok: true, storage: `json-local:${ASSET_STORE_FILE}` };
}

export async function listMergedDysonAssets() {
  const defaults = listDefaultDysonAssets();
  const overrides = await readDysonAssetOverrides();
  const assets = defaults.map((asset) => ({
    ...asset,
    ...(overrides[asset.sphere_key] || {}),
    sphere_key: asset.sphere_key,
    staticDefault: asset.staticDefault,
    customized: Boolean(overrides[asset.sphere_key]),
  }));

  return { assets, overrides };
}

export async function upsertDysonAssetOverride(sphereKey, patch, actor = null) {
  const defaults = getDefaultDysonAssetMap();
  if (!defaults.has(sphereKey)) {
    return { ok: false, error: 'UNKNOWN_SPHERE_KEY' };
  }

  const overrides = await readDysonAssetOverrides();
  const previousOverride = overrides[sphereKey] || {};
  const defaultAsset = defaults.get(sphereKey);
  const nextOverride = {
    ...previousOverride,
    ...patch,
    sphere_key: sphereKey,
    updated_at: new Date().toISOString(),
    updated_by: actor?.id || actor?.provider || 'admin',
  };

  overrides[sphereKey] = nextOverride;
  const storage = await writeDysonAssetOverrides(overrides);

  return {
    ok: true,
    asset: {
      ...defaultAsset,
      ...nextOverride,
      customized: true,
      staticDefault: true,
    },
    storage,
  };
}
