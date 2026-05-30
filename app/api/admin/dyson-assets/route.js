import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { resolveAdminContext, toAdminAuthErrorResponse } from '@/lib/auth/resolveAdminContext';
import { listDysonAssets, upsertDysonAsset } from './store';

function adminError(adminContext) {
  return NextResponse.json(toAdminAuthErrorResponse(adminContext), { status: adminContext.status });
}

export async function GET() {
  const adminContext = resolveAdminContext(cookies());
  if (!adminContext.authorized) return adminError(adminContext);

  return NextResponse.json({ assets: listDysonAssets() });
}

export async function POST(request) {
  const adminContext = resolveAdminContext(cookies());
  if (!adminContext.authorized) return adminError(adminContext);

  const payload = await request.json().catch(() => null);
  const result = upsertDysonAsset(payload);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ asset: result.asset }, { status: 201 });
}
