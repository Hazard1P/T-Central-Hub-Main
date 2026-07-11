import { NextResponse } from 'next/server';
import { getPlayableSectionPolicy } from '@/lib/playableSectionPolicy';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const server = searchParams.get('server') || 'arma3-cth';
  const identityScope = searchParams.get('scope') || 'guest';
  const playableAt = searchParams.get('playableAt') || searchParams.get('day') || Date.now();

  return NextResponse.json({
    ok: true,
    policy: getPlayableSectionPolicy({ selectedSlug: server, identityScope, playableAt }),
  });
}
