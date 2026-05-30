import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { resolveAdminContext, toAdminAuthErrorResponse } from '@/lib/auth/resolveAdminContext';
import { deleteDysonAsset, getDysonAsset, patchDysonAsset } from '../store';

function adminError(adminContext) {
  return NextResponse.json(toAdminAuthErrorResponse(adminContext), { status: adminContext.status });
}

export async function GET(_request, { params }) {
  const adminContext = resolveAdminContext(cookies());
  if (!adminContext.authorized) return adminError(adminContext);

  const asset = getDysonAsset(params?.assetId);
  if (!asset) return NextResponse.json({ error: 'DYSON_ASSET_NOT_FOUND' }, { status: 404 });

  return NextResponse.json({ asset });
}

export async function PATCH(request, { params }) {
  const adminContext = resolveAdminContext(cookies());
  if (!adminContext.authorized) return adminError(adminContext);

  const payload = await request.json().catch(() => null);
  const result = patchDysonAsset(params?.assetId, payload);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ asset: result.asset });
}

export async function DELETE(_request, { params }) {
  const adminContext = resolveAdminContext(cookies());
  if (!adminContext.authorized) return adminError(adminContext);

  const result = deleteDysonAsset(params?.assetId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
