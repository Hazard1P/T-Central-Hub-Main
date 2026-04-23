import { NextResponse } from 'next/server';
import { getServerBySlug } from '@/lib/serverData';

export async function GET() {
  const server = getServerBySlug('arma3-cth');
  if (!server) {
    return NextResponse.json({ ok: false, error: 'ARMA_SERVER_NOT_CONFIGURED' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    server: {
      id: server.id,
      slug: server.slug,
      ip: server.ip,
      steamAppId: server.steamAppId,
      launchLabel: server.launchLabel,
      connectLabel: server.connectLabel,
      integration: server.integration,
    },
  });
}
