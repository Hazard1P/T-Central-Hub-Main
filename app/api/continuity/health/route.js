import { NextResponse } from 'next/server';
import { continuityHealthService } from '@/lib/continuity/continuityHealthService';
import { readLatestContinuityDrillReport } from '@/lib/continuity/continuityDrillService';

export const dynamic = 'force-dynamic';

export async function GET() {
  continuityHealthService.start();
  const snapshot = await continuityHealthService.persistSnapshot(continuityHealthService.evaluate());
  const continuityDrill = await readLatestContinuityDrillReport();

  return NextResponse.json({
    ok: true,
    continuityHealth: snapshot,
    continuityDrill,
    launchGate: {
      authoritative: 'runtime',
      ciGateScript: 'scripts/check-dyson-continuity.mjs',
      status: snapshot.gateStatus,
    },
  });
}
