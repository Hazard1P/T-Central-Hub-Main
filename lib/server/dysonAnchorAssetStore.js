import 'server-only';

import { getSupabaseAdmin, hasSupabaseAdmin } from '@/lib/server/supabaseAdmin';
import { WORLD_LAYOUT } from '@/lib/worldLayout';

export const DYSON_ANCHOR_ASSETS_TABLE = 'dyson_anchor_assets';

const DEFAULT_RING_FACTORS = {
  ring_one_factor: 1,
  ring_two_factor: 1,
  ring_three_factor: 1,
};

const DEFAULT_STELLAR_CLASS_BY_PROFILE = {
  csis: 'A0V',
  synaptics: 'F8V',
};

function nowIso() {
  return new Date().toISOString();
}

function toFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeColor(value, fallback) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function getStaticDysonNode(sphereKey) {
  return WORLD_LAYOUT.find((node) => node.kind === 'dyson' && node.key === sphereKey) || null;
}

function toStaticDysonAsset(node) {
  const [positionX = 0, positionY = 0, positionZ = 0] = Array.isArray(node.position) ? node.position : [];
  const profileKey = node.dysonProfile || node.key;

  return {
    sphere_key: node.key,
    label: node.label,
    position_x: toFiniteNumber(positionX, 0),
    position_y: toFiniteNumber(positionY, 0),
    position_z: toFiniteNumber(positionZ, 0),
    ring_one_factor: DEFAULT_RING_FACTORS.ring_one_factor,
    ring_two_factor: DEFAULT_RING_FACTORS.ring_two_factor,
    ring_three_factor: DEFAULT_RING_FACTORS.ring_three_factor,
    encryption_strength_override: null,
    stellar_class: DEFAULT_STELLAR_CLASS_BY_PROFILE[profileKey] || 'G2V',
    color: normalizeColor(node.color, '#9dd0ff'),
    updated_by: 'static-world-layout',
    updated_at: null,
    source: 'static-world-layout',
  };
}

export function getStaticDysonAnchorAssets() {
  return WORLD_LAYOUT
    .filter((node) => node.kind === 'dyson')
    .map(toStaticDysonAsset);
}

export function getStaticDysonAnchorAsset(sphereKey) {
  const node = getStaticDysonNode(String(sphereKey || '').trim());
  return node ? toStaticDysonAsset(node) : null;
}

function normalizeDysonAnchorAsset(row, fallback = null) {
  const sphereKey = String(row?.sphere_key || fallback?.sphere_key || '').trim();
  if (!sphereKey) return null;

  return {
    sphere_key: sphereKey,
    label: String(row?.label || fallback?.label || sphereKey),
    position_x: toFiniteNumber(row?.position_x, fallback?.position_x ?? 0),
    position_y: toFiniteNumber(row?.position_y, fallback?.position_y ?? 0),
    position_z: toFiniteNumber(row?.position_z, fallback?.position_z ?? 0),
    ring_one_factor: toFiniteNumber(row?.ring_one_factor, fallback?.ring_one_factor ?? DEFAULT_RING_FACTORS.ring_one_factor),
    ring_two_factor: toFiniteNumber(row?.ring_two_factor, fallback?.ring_two_factor ?? DEFAULT_RING_FACTORS.ring_two_factor),
    ring_three_factor: toFiniteNumber(row?.ring_three_factor, fallback?.ring_three_factor ?? DEFAULT_RING_FACTORS.ring_three_factor),
    encryption_strength_override: row?.encryption_strength_override == null
      ? (fallback?.encryption_strength_override ?? null)
      : toFiniteNumber(row.encryption_strength_override, fallback?.encryption_strength_override ?? null),
    stellar_class: String(row?.stellar_class || fallback?.stellar_class || 'G2V'),
    color: normalizeColor(row?.color, fallback?.color || '#9dd0ff'),
    updated_by: row?.updated_by || fallback?.updated_by || 'system',
    updated_at: row?.updated_at || fallback?.updated_at || null,
    source: row?.sphere_key ? 'supabase' : fallback?.source || 'static-world-layout',
  };
}

function mergeWithStaticFallback(rows = []) {
  const staticAssets = getStaticDysonAnchorAssets();
  const rowByKey = new Map(rows.map((row) => [String(row?.sphere_key || '').trim(), row]));
  const mergedStaticAssets = staticAssets.map((fallback) => normalizeDysonAnchorAsset(rowByKey.get(fallback.sphere_key), fallback));
  const staticKeys = new Set(staticAssets.map((asset) => asset.sphere_key));
  const dynamicAssets = rows
    .filter((row) => row?.sphere_key && !staticKeys.has(String(row.sphere_key).trim()))
    .map((row) => normalizeDysonAnchorAsset(row))
    .filter(Boolean);

  return [...mergedStaticAssets, ...dynamicAssets];
}

export function hasDysonAnchorAssetStore() {
  return hasSupabaseAdmin();
}

export async function getDysonAnchorAssets() {
  const fallbackAssets = getStaticDysonAnchorAssets();
  const admin = getSupabaseAdmin();
  if (!admin) return fallbackAssets;

  const { data, error } = await admin
    .from(DYSON_ANCHOR_ASSETS_TABLE)
    .select('sphere_key,label,position_x,position_y,position_z,ring_one_factor,ring_two_factor,ring_three_factor,encryption_strength_override,stellar_class,color,updated_by,updated_at')
    .order('sphere_key', { ascending: true });

  if (error) {
    console.warn(`Falling back to static Dyson anchor assets: ${error.message}`);
    return fallbackAssets;
  }

  return mergeWithStaticFallback(data || []);
}

export async function getDysonAnchorAsset(sphereKey) {
  const normalizedSphereKey = String(sphereKey || '').trim();
  const fallback = getStaticDysonAnchorAsset(normalizedSphereKey);
  if (!normalizedSphereKey) return fallback;

  const admin = getSupabaseAdmin();
  if (!admin) return fallback;

  const { data, error } = await admin
    .from(DYSON_ANCHOR_ASSETS_TABLE)
    .select('sphere_key,label,position_x,position_y,position_z,ring_one_factor,ring_two_factor,ring_three_factor,encryption_strength_override,stellar_class,color,updated_by,updated_at')
    .eq('sphere_key', normalizedSphereKey)
    .maybeSingle();

  if (error) {
    console.warn(`Falling back to static Dyson anchor asset for ${normalizedSphereKey}: ${error.message}`);
    return fallback;
  }

  return normalizeDysonAnchorAsset(data, fallback);
}

export async function upsertDysonAnchorAsset(asset, { updatedBy = 'server' } = {}) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Supabase admin is not configured for Dyson anchor asset writes');

  const normalized = normalizeDysonAnchorAsset({
    ...asset,
    updated_by: updatedBy,
    updated_at: nowIso(),
  }, getStaticDysonAnchorAsset(asset?.sphere_key));

  if (!normalized?.sphere_key) throw new Error('Dyson anchor asset requires a sphere_key');

  const payload = {
    sphere_key: normalized.sphere_key,
    label: normalized.label,
    position_x: normalized.position_x,
    position_y: normalized.position_y,
    position_z: normalized.position_z,
    ring_one_factor: normalized.ring_one_factor,
    ring_two_factor: normalized.ring_two_factor,
    ring_three_factor: normalized.ring_three_factor,
    encryption_strength_override: normalized.encryption_strength_override,
    stellar_class: normalized.stellar_class,
    color: normalized.color,
    updated_by: normalized.updated_by,
    updated_at: normalized.updated_at,
  };

  const { data, error } = await admin
    .from(DYSON_ANCHOR_ASSETS_TABLE)
    .upsert(payload, { onConflict: 'sphere_key' })
    .select('sphere_key,label,position_x,position_y,position_z,ring_one_factor,ring_two_factor,ring_three_factor,encryption_strength_override,stellar_class,color,updated_by,updated_at')
    .single();

  if (error) throw new Error(`Unable to persist Dyson anchor asset: ${error.message}`);
  return normalizeDysonAnchorAsset(data, getStaticDysonAnchorAsset(normalized.sphere_key));
}
