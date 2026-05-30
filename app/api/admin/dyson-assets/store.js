const runtime = globalThis.__dysonAdminAssetRuntime || {
  assets: new Map(),
};

if (!globalThis.__dysonAdminAssetRuntime) {
  globalThis.__dysonAdminAssetRuntime = runtime;
}

function normalizeAssetId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function serializeAsset(asset) {
  return {
    id: asset.id,
    name: asset.name,
    kind: asset.kind,
    metadata: asset.metadata,
    updatedAt: asset.updatedAt,
  };
}

export function listDysonAssets() {
  return Array.from(runtime.assets.values()).map(serializeAsset);
}

export function getDysonAsset(assetId) {
  const id = normalizeAssetId(assetId);
  return id ? serializeAsset(runtime.assets.get(id) || null) : null;
}

export function upsertDysonAsset(payload) {
  const name = String(payload?.name || '').trim();
  const id = normalizeAssetId(payload?.id || name);

  if (!id || !name) {
    return { ok: false, status: 400, error: 'DYSON_ASSET_INVALID' };
  }

  const asset = {
    id,
    name,
    kind: String(payload?.kind || 'dyson-asset').trim() || 'dyson-asset',
    metadata: payload?.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
      ? payload.metadata
      : {},
    updatedAt: new Date().toISOString(),
  };

  runtime.assets.set(id, asset);
  return { ok: true, asset: serializeAsset(asset) };
}

export function patchDysonAsset(assetId, payload) {
  const id = normalizeAssetId(assetId);
  const existing = id ? runtime.assets.get(id) : null;

  if (!existing) {
    return { ok: false, status: 404, error: 'DYSON_ASSET_NOT_FOUND' };
  }

  const next = {
    ...existing,
    name: payload?.name ? String(payload.name).trim() : existing.name,
    kind: payload?.kind ? String(payload.kind).trim() : existing.kind,
    metadata: payload?.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
      ? payload.metadata
      : existing.metadata,
    updatedAt: new Date().toISOString(),
  };

  runtime.assets.set(id, next);
  return { ok: true, asset: serializeAsset(next) };
}

export function deleteDysonAsset(assetId) {
  const id = normalizeAssetId(assetId);
  const deleted = id ? runtime.assets.delete(id) : false;
  return deleted ? { ok: true } : { ok: false, status: 404, error: 'DYSON_ASSET_NOT_FOUND' };
}
