import { NextResponse } from 'next/server';
import { authorizeAdminRequest, adminUnauthorizedResponse } from '@/lib/server/adminAuthorization';
import {
  DYSON_ASSET_PARAMETER_RANGES,
  getDefaultDysonAssetMap,
  listMergedDysonAssets,
  upsertDysonAssetOverride,
} from '@/lib/server/dysonAnchorAssets';

export const dynamic = 'force-dynamic';

const RING_FACTOR_KEYS = ['ring1', 'ring2', 'ring3'];
const VECTOR_FIELDS = ['position'];

function structuredError(code, message, details = {}, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message, details } }, { status });
}

function parseFiniteNumber(value, field, errors) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    errors.push({ field, code: 'FINITE_NUMBER_REQUIRED', message: `${field} must be a finite number.` });
    return null;
  }
  return number;
}

function clampNumber(value, range) {
  return Math.min(range.max, Math.max(range.min, value));
}

function validateVector(value, field, errors) {
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? [value.x, value.y, value.z]
      : null;

  if (!raw || raw.length !== 3) {
    errors.push({ field, code: 'VECTOR3_REQUIRED', message: `${field} must be a three-number vector.` });
    return null;
  }

  const vector = raw.map((component, index) => parseFiniteNumber(component, `${field}[${index}]`, errors));
  return vector.every((component) => component !== null) ? vector : null;
}

function normalizeRingFactors(body, errors, warnings) {
  const rawRingFactors = body.ring_factors || body.ringFactors;
  const normalized = {};

  if (rawRingFactors && typeof rawRingFactors !== 'object') {
    errors.push({ field: 'ring_factors', code: 'OBJECT_REQUIRED', message: 'ring_factors must be an object keyed by ring1, ring2, and ring3.' });
    return null;
  }

  for (const key of RING_FACTOR_KEYS) {
    const rawValue = rawRingFactors?.[key] ?? body[`${key}_factor`] ?? body[`${key}Factor`];
    if (rawValue === undefined) continue;

    const parsed = parseFiniteNumber(rawValue, `ring_factors.${key}`, errors);
    if (parsed === null) continue;

    const range = DYSON_ASSET_PARAMETER_RANGES.ringFactors;
    const clamped = clampNumber(parsed, range);
    if (clamped !== parsed) {
      warnings.push({
        field: `ring_factors.${key}`,
        code: 'VALUE_CLAMPED',
        message: `Ring factors are clamped to ${range.min}-${range.max}.`,
        input: parsed,
        value: clamped,
      });
    }
    normalized[key] = clamped;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function normalizeEncryptionFactor(body, errors, warnings) {
  const rawValue = body.encryption_factor ?? body.encryptionFactor;
  if (rawValue === undefined) return undefined;

  const parsed = parseFiniteNumber(rawValue, 'encryption_factor', errors);
  if (parsed === null) return undefined;

  const range = DYSON_ASSET_PARAMETER_RANGES.encryptionFactor;
  const clamped = clampNumber(parsed, range);
  if (clamped !== parsed) {
    warnings.push({
      field: 'encryption_factor',
      code: 'VALUE_CLAMPED',
      message: `Encryption factors are clamped to ${range.min}-${range.max}.`,
      input: parsed,
      value: clamped,
    });
  }
  return clamped;
}

function normalizeEditableScalars(body) {
  const patch = {};
  if (typeof body.label === 'string') patch.label = body.label.trim();
  if (typeof body.description === 'string') patch.description = body.description.trim();
  if (typeof body.address === 'string') patch.address = body.address.trim();
  if (typeof body.color === 'string') patch.color = body.color.trim();
  if (Array.isArray(body.tags)) patch.tags = body.tags.filter((tag) => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean);
  return patch;
}

function validateDysonAssetPayload(body, defaults) {
  const errors = [];
  const warnings = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, errors: [{ field: 'body', code: 'OBJECT_REQUIRED', message: 'Request body must be a JSON object.' }], warnings: [] };
  }

  const sphereKey = String(body.sphere_key || body.sphereKey || '').trim();
  if (!sphereKey) {
    errors.push({ field: 'sphere_key', code: 'REQUIRED', message: 'sphere_key is required.' });
  } else if (!defaults.has(sphereKey)) {
    errors.push({
      field: 'sphere_key',
      code: 'UNKNOWN_SPHERE_KEY',
      message: `Unknown Dyson sphere key: ${sphereKey}.`,
      allowedValues: [...defaults.keys()],
    });
  }

  const patch = normalizeEditableScalars(body);

  for (const field of VECTOR_FIELDS) {
    if (body[field] !== undefined) {
      const vector = validateVector(body[field], field, errors);
      if (vector) patch[field] = vector;
    }
  }

  const ringFactors = normalizeRingFactors(body, errors, warnings);
  if (ringFactors) {
    const defaultFactors = defaults.get(sphereKey)?.ring_factors || {};
    patch.ring_factors = { ...defaultFactors, ...ringFactors };
  }

  const encryptionFactor = normalizeEncryptionFactor(body, errors, warnings);
  if (encryptionFactor !== undefined) patch.encryption_factor = encryptionFactor;

  if (Object.keys(patch).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', code: 'NO_UPDATES', message: 'Provide at least one editable Dyson asset field to update.' });
  }

  return { ok: errors.length === 0, sphereKey, patch, errors, warnings };
}

export async function GET(request) {
  const auth = authorizeAdminRequest(request);
  if (!auth.ok) return adminUnauthorizedResponse(auth);

  const { assets } = await listMergedDysonAssets();
  return NextResponse.json({
    ok: true,
    assets,
    defaults: {
      sphere_keys: assets.map((asset) => asset.sphere_key),
      parameter_ranges: DYSON_ASSET_PARAMETER_RANGES,
    },
    generated_at: new Date().toISOString(),
  });
}

async function handleUpdate(request) {
  const auth = authorizeAdminRequest(request);
  if (!auth.ok) return adminUnauthorizedResponse(auth);

  let body;
  try {
    body = await request.json();
  } catch {
    return structuredError('INVALID_JSON_BODY', 'Request body must be valid JSON.', {}, 400);
  }

  const defaults = getDefaultDysonAssetMap();
  const validation = validateDysonAssetPayload(body, defaults);
  if (!validation.ok) {
    return structuredError('DYSON_ASSET_VALIDATION_FAILED', 'Dyson asset update failed validation.', {
      errors: validation.errors,
      warnings: validation.warnings,
    }, 400);
  }

  let result;
  try {
    result = await upsertDysonAssetOverride(validation.sphereKey, validation.patch, auth.admin);
  } catch (error) {
    return structuredError('DYSON_ASSET_WRITE_FAILED', 'Unable to persist the Dyson asset update.', {
      reason: error?.message || 'UNKNOWN_WRITE_ERROR',
    }, 500);
  }

  if (!result.ok) {
    return structuredError('UNKNOWN_SPHERE_KEY', 'The requested Dyson sphere key is not editable.', {
      sphere_key: validation.sphereKey,
      allowedValues: [...defaults.keys()],
    }, 404);
  }

  return NextResponse.json({
    ok: true,
    asset: result.asset,
    warnings: validation.warnings,
    storage: result.storage,
  });
}

export async function PUT(request) {
  return handleUpdate(request);
}

export async function PATCH(request) {
  return handleUpdate(request);
}
