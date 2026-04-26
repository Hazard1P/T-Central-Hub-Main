import { NextResponse } from 'next/server';
import { getGatewayStatus, migrateIntoGame } from '@/lib/integrations/standaloneBlackholeGateway';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getGatewayStatus());
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const result = migrateIntoGame({
    payload: body?.payload || {},
    payloadType: body?.payloadType,
    entryVector: body?.entryVector,
    exitVector: body?.exitVector,
    requestedBy: body?.requestedBy || 'api',
  });

  const status = result.ok ? 200 : 422;
  return NextResponse.json(result, { status });
}
