import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptJson } from '@/lib/security';
import { buildUniverseGraph } from '@/lib/universeEngine';
import { toAdminDysonAssetCollection } from '@/lib/dysonAssetResponses';

export const dynamic = 'force-dynamic';

function readAdminSession() {
  const cookieStore = cookies();
  const raw = cookieStore.get('steam_session')?.value || cookieStore.get('google_session')?.value;
  if (!raw) return null;

  try {
    const session = decryptJson(raw);
    if (session?.is_admin || session?.isAdmin || session?.role === 'admin') {
      return session;
    }
  } catch {
    return null;
  }

  return null;
}

export async function GET() {
  const adminSession = readAdminSession();
  if (!adminSession) {
    return NextResponse.json({ ok: false, error: 'ADMIN_AUTH_REQUIRED' }, { status: 401 });
  }

  const graph = buildUniverseGraph(Date.now(), {
    lobbyMode: 'hub',
    authenticated: true,
  });
  const dysonAssets = graph.nodes.filter((node) => node.kind === 'dyson');

  return NextResponse.json({
    ok: true,
    response_shape: 'admin_dyson_asset.v1',
    assets: toAdminDysonAssetCollection(dysonAssets, {
      routeLinks: graph.routeLinks,
      actor: {
        accountId: adminSession.steamid || adminSession.sub || null,
        displayName: adminSession.personaname || adminSession.name || adminSession.email || null,
      },
    }),
    generatedAt: new Date().toISOString(),
  });
}
