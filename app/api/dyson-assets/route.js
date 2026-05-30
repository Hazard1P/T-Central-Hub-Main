import { NextResponse } from 'next/server';
import { buildUniverseGraph } from '@/lib/universeEngine';
import { toPublicDysonAssetCollection } from '@/lib/dysonAssetResponses';

export const dynamic = 'force-dynamic';

export async function GET() {
  const graph = buildUniverseGraph(Date.now(), { lobbyMode: 'hub' });
  const dysonAssets = graph.nodes.filter((node) => node.kind === 'dyson');

  return NextResponse.json({
    ok: true,
    response_shape: 'public_dyson_asset.v1',
    assets: toPublicDysonAssetCollection(dysonAssets, { routeLinks: graph.routeLinks }),
    generatedAt: new Date().toISOString(),
  });
}
