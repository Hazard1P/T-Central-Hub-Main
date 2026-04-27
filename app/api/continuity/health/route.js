import { NextResponse } from 'next/server';
import { continuityHealthService } from '@/lib/continuity/continuityHealthService';

export const dynamic = 'force-dynamic';

export async function GET() {
  continuityHealthService.start();
  const snapshot = await continuityHealthService.persistSnapshot(continuityHealthService.evaluate());

  return NextResponse.json({
    ok: true,
    continuityHealth: snapshot,
    launchGate: {
      authoritative: 'runtime',
      ciGateScript: 'scripts/check-dyson-continuity.mjs',
      status: snapshot.gateStatus,
    },
  });
}
