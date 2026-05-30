import { WORLD_LAYOUT } from '@/lib/worldLayout';
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin';

export const DYSON_ASSETS_TABLE = 'dyson_assets';

export const ALLOWED_DYSON_PARAMETER_FIELDS = [
  'label',
  'address',
  'description',
  'color',
  'priority',
  'dysonProfile',
  'networkRole',
  'foundationBuilt',
  'systemOwned',
  'playerInteractive',
  'playerBuildable',
  'requestSurface',
  'routeSurface',
  'encryptionOwned',
];

const BOOLEAN_FIELDS = new Set(['foundationBuilt', 'systemOwned', 'playerInteractive', 'playerBuildable', 'requestSurface', 'encryptionOwned']);
const STRING_FIELDS = new Set(['label', 'address', 'description', 'color', 'dysonProfile', 'networkRole', 'routeSurface']);
const NUMBER_FIELDS = new Set(['priority']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function keyedDefaults() {
  return getDefaultDysonAssetPayloads().reduce((acc, asset) => {
    acc[asset.key] = asset;
    return acc;
  }, {});
}

export function getAllowedDysonParameterFields() {
  return [...ALLOWED_DYSON_PARAMETER_FIELDS];
}

export function serializeDysonAsset(node) {
  const parameters = {};
  for (const field of ALLOWED_DYSON_PARAMETER_FIELDS) {
    if (node[field] !== undefined) parameters[field] = node[field];
  }

  return {
    key: node.key,
    kind: node.kind,
    mapAnchor: {
      x: Number(node.position?.[0] ?? 0),
      y: Number(node.position?.[1] ?? 0),
      z: Number(node.position?.[2] ?? 0),
    },
    parameters,
  };
}

export function getDefaultDysonAssetPayloads() {
  return WORLD_LAYOUT.filter((node) => node.kind === 'dyson').map(serializeDysonAsset);
}

export function mergeDysonAsset(defaultAsset, override) {
  if (!override) return clone(defaultAsset);
  return {
    ...clone(defaultAsset),
    ...clone(override),
    key: defaultAsset.key,
    kind: 'dyson',
    mapAnchor: {
      ...clone(defaultAsset.mapAnchor),
      ...(override.mapAnchor || {}),
    },
    parameters: {
      ...clone(defaultAsset.parameters || {}),
      ...(override.parameters || {}),
    },
  };
}

export function validateDysonAssetPayload(payload) {
  const errors = {};
  const defaults = keyedDefaults();
  const key = String(payload?.key || '').trim();

  if (!key) errors.key = 'Dyson asset key is required.';
  if (key && !defaults[key]) errors.key = 'Unknown Dyson asset key. Only lib/worldLayout.js Dyson defaults can be edited.';

  const mapAnchor = payload?.mapAnchor || {};
  for (const axis of ['x', 'y', 'z']) {
    const value = mapAnchor[axis];
    const numeric = Number(value);
    if (value === '' || value === null || value === undefined || !Number.isFinite(numeric)) {
      errors[`mapAnchor.${axis}`] = `${axis.toUpperCase()} must be a finite number.`;
    }
  }

  const submittedParameters = payload?.parameters || {};
  for (const field of Object.keys(submittedParameters)) {
    if (!ALLOWED_DYSON_PARAMETER_FIELDS.includes(field)) {
      errors[`parameters.${field}`] = `${field} is not an allowed Dyson parameter.`;
      continue;
    }

    const value = submittedParameters[field];
    if (BOOLEAN_FIELDS.has(field) && typeof value !== 'boolean') {
      errors[`parameters.${field}`] = `${field} must be true or false.`;
    }
    if (STRING_FIELDS.has(field) && value !== null && value !== undefined && typeof value !== 'string') {
      errors[`parameters.${field}`] = `${field} must be text.`;
    }
    if (NUMBER_FIELDS.has(field) && !Number.isFinite(Number(value))) {
      errors[`parameters.${field}`] = `${field} must be a finite number.`;
    }
  }

  const sanitized = key && defaults[key] ? mergeDysonAsset(defaults[key], {
    key,
    kind: 'dyson',
    mapAnchor: {
      x: Number(mapAnchor.x),
      y: Number(mapAnchor.y),
      z: Number(mapAnchor.z),
    },
    parameters: sanitizeDysonParameters(submittedParameters),
  }) : null;

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    asset: sanitized,
  };
}

export function sanitizeDysonParameters(parameters = {}) {
  const sanitized = {};
  for (const field of ALLOWED_DYSON_PARAMETER_FIELDS) {
    if (!(field in parameters)) continue;
    if (BOOLEAN_FIELDS.has(field)) sanitized[field] = Boolean(parameters[field]);
    else if (NUMBER_FIELDS.has(field)) sanitized[field] = Number(parameters[field]);
    else sanitized[field] = parameters[field] == null ? '' : String(parameters[field]);
  }
  return sanitized;
}

export async function readDysonAssets() {
  const defaults = getDefaultDysonAssetPayloads();
  const admin = getSupabaseAdmin();
  if (!admin) {
    return { ok: true, source: 'worldLayout', persisted: false, assets: defaults, defaults, allowedParameters: getAllowedDysonParameterFields() };
  }

  const { data, error } = await admin.from(DYSON_ASSETS_TABLE).select('asset_key,payload,updated_at');
  if (error) return { ok: false, error: 'DYSON_ASSETS_READ_FAILED', detail: error.message };

  const overrides = new Map((data || []).map((row) => [row.asset_key, { ...(row.payload || {}), updatedAt: row.updated_at }]));
  return {
    ok: true,
    source: 'database',
    persisted: true,
    assets: defaults.map((asset) => mergeDysonAsset(asset, overrides.get(asset.key))),
    defaults,
    allowedParameters: getAllowedDysonParameterFields(),
  };
}

export async function saveDysonAsset(asset, actor = 'admin-api') {
  const validation = validateDysonAssetPayload(asset);
  if (!validation.ok) return { ok: false, error: 'VALIDATION_FAILED', errors: validation.errors };

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: 'DYSON_ASSETS_UNAVAILABLE', detail: 'Supabase admin credentials are not configured.' };

  const now = new Date().toISOString();
  const payload = {
    ...validation.asset,
    updatedBy: actor,
    updatedAt: now,
  };
  const { data, error } = await admin
    .from(DYSON_ASSETS_TABLE)
    .upsert({ asset_key: validation.asset.key, payload, updated_at: now }, { onConflict: 'asset_key' })
    .select('asset_key,payload,updated_at')
    .single();

  if (error) return { ok: false, error: 'DYSON_ASSET_SAVE_FAILED', detail: error.message };
  return { ok: true, asset: mergeDysonAsset(keyedDefaults()[validation.asset.key], data.payload), updatedAt: data.updated_at };
}

export async function deleteDysonAssetOverride(key) {
  const defaults = keyedDefaults();
  if (!defaults[key]) return { ok: false, error: 'UNKNOWN_DYSON_ASSET', errors: { key: 'Unknown Dyson asset key.' } };

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: 'DYSON_ASSETS_UNAVAILABLE', detail: 'Supabase admin credentials are not configured.' };

  const { error } = await admin.from(DYSON_ASSETS_TABLE).delete().eq('asset_key', key);
  if (error) return { ok: false, error: 'DYSON_ASSET_DELETE_FAILED', detail: error.message };
  return { ok: true, asset: defaults[key] };
}
