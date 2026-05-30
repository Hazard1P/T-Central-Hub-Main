const PUBLIC_ROUTE_KEYS = ['href', 'route', 'external', 'sublabel', 'kind', 'category'];

function asPosition(value) {
  return Array.isArray(value)
    ? value.slice(0, 3).map((coordinate) => {
        const n = Number(coordinate);
        return Number.isFinite(n) ? n : 0;
      })
    : [0, 0, 0];
}

function pickRouteMetadata(asset = {}) {
  return PUBLIC_ROUTE_KEYS.reduce((metadata, key) => {
    if (asset[key] !== undefined && asset[key] !== null) {
      metadata[key] = asset[key];
    }
    return metadata;
  }, {});
}

function pickDysonRouteLinks(asset = {}, routeLinks = []) {
  const sphereKey = asset.sphere_key || asset.key;
  if (!sphereKey) return [];

  return routeLinks
    .filter((link) => link?.from === sphereKey || link?.to === sphereKey)
    .map((link) => ({
      key: link.key,
      from: link.from,
      to: link.to,
      color: link.color,
      arc: link.arc,
      weight: link.weight,
    }));
}

export function toPublicDysonAssetResponse(asset = {}, { routeLinks = [] } = {}) {
  const sphereKey = String(asset.sphere_key || asset.key || asset.id || '').trim();

  return {
    sphere_key: sphereKey,
    label: String(asset.label || sphereKey || 'Dyson sphere'),
    position: asPosition(asset.position),
    color: typeof asset.color === 'string' ? asset.color : '#ffd67d',
    description: String(asset.description || ''),
    route_metadata: pickRouteMetadata(asset),
    route_links: pickDysonRouteLinks({ ...asset, sphere_key: sphereKey }, routeLinks),
  };
}

export function toAdminDysonAssetResponse(asset = {}, { routeLinks = [], actor = null } = {}) {
  const publicAsset = toPublicDysonAssetResponse(asset, { routeLinks });
  const dysonState = asset.dysonState || {};

  return {
    ...publicAsset,
    database_row_id: asset.database_row_id || asset.dbRowId || asset.id || null,
    source_key: asset.key || publicAsset.sphere_key,
    editable_fields: {
      route: asset.route || asset.href || null,
      address: asset.address || null,
      tags: Array.isArray(asset.tags) ? [...asset.tags] : [],
      dysonProfile: asset.dysonProfile || null,
      foundationBuilt: Boolean(asset.foundationBuilt),
      networkRole: asset.networkRole || null,
      encryptionOwned: Boolean(asset.encryptionOwned),
    },
    ring_factors: {
      ring1: dysonState.ring1 || null,
      ring2: dysonState.ring2 || null,
      ring3: dysonState.ring3 || null,
      labels: {
        ringOneLabel: dysonState.ringOneLabel || null,
        ringTwoLabel: dysonState.ringTwoLabel || null,
        ringThreeLabel: dysonState.ringThreeLabel || null,
      },
    },
    parameter_overrides: asset.parameterOverrides || asset.parameter_overrides || {},
    updated_by: asset.updated_by || asset.updatedBy || actor?.displayName || actor?.accountId || null,
    updated_at: asset.updated_at || asset.updatedAt || null,
  };
}

export function toPublicDysonAssetCollection(assets = [], options = {}) {
  return assets.map((asset) => toPublicDysonAssetResponse(asset, options));
}

export function toAdminDysonAssetCollection(assets = [], options = {}) {
  return assets.map((asset) => toAdminDysonAssetResponse(asset, options));
}
