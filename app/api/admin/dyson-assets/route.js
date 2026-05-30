import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptJson } from '@/lib/security';
import { deleteDysonAssetOverride, getDefaultDysonAssetPayloads, readDysonAssets, saveDysonAsset } from '@/lib/dysonAssets';

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function isAdminCookie() {
  const raw = cookies().get('steam_session')?.value;
  if (!raw) return false;
  try {
    const session = decryptJson(raw);
    return Boolean(session?.is_admin || session?.isAdmin || session?.role === 'admin');
  } catch {
    return false;
  }
}

function isAdminRequest(request) {
  const configuredToken = process.env.ADMIN_DYSON_ASSETS_TOKEN || process.env.ADMIN_API_TOKEN;
  const requestToken = request.headers.get('x-admin-token');
  return isAdminCookie() || Boolean(configuredToken && requestToken && safeEqual(requestToken, configuredToken));
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'UNAUTHORIZED_DYSON_ASSETS_ADMIN' }, { status: 401 });
}

export async function GET(request) {
  if (!isAdminRequest(request)) return unauthorized();

  const result = await readDysonAssets();
  if (!result.ok) return NextResponse.json(result, { status: 500 });
  return NextResponse.json(result);
}

export async function PATCH(request) {
  if (!isAdminRequest(request)) return unauthorized();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_JSON_BODY' }, { status: 400 });
  }

  const key = String(body?.key || body?.asset?.key || '').trim();

  if (body?.deleteOverride) {
    if (body?.confirmDeleteRecord !== true) {
      return NextResponse.json({ ok: false, error: 'DELETE_CONFIRMATION_REQUIRED', errors: { deleteOverride: 'Confirm database-record deletion before removing this override.' } }, { status: 400 });
    }
    const result = await deleteDysonAssetOverride(key);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  let asset = body?.asset || body;
  if (body?.resetToDefaults) {
    const defaults = getDefaultDysonAssetPayloads();
    asset = defaults.find((item) => item.key === key);
    if (!asset) {
      return NextResponse.json({ ok: false, error: 'UNKNOWN_DYSON_ASSET', errors: { key: 'Unknown Dyson asset key.' } }, { status: 400 });
    }
  }

  const result = await saveDysonAsset(asset, request.headers.get('x-admin-actor') || 'dyson-assets-editor');
  if (!result.ok) {
    const status = result.error === 'VALIDATION_FAILED' ? 400 : 503;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
