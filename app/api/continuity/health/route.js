import { NextResponse } from 'next/server';
import { continuityHealthService } from '@/lib/continuity/continuityHealthService';

export const dynamic = 'force-dynamic';

export async function GET() {
  continuityHealthService.start();
  const { snapshot, persistence } = await continuityHealthService.persistSnapshot(continuityHealthService.evaluate());

  const ringHealthy = snapshot.gateStatus === 'open';
  const durableRecoverable = persistence.recoverableFromDurableSource;
  const warnings = [];

  if (!durableRecoverable) {
    warnings.push('Continuity is running in memory-only mode; no durable checkpoint source is currently recoverable.');
  }

  const ok = ringHealthy && durableRecoverable;

  return NextResponse.json({
    ok,
    warnings,
    continuityHealth: snapshot,
    persistence,
    launchGate: {
      authoritative: 'runtime',
      ciGateScript: 'scripts/check-dyson-continuity.mjs',
      status: ringHealthy && !durableRecoverable ? 'blocked' : snapshot.gateStatus,
    },
  });
}
