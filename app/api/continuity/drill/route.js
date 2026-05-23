import { NextResponse } from 'next/server';
import { runContinuityDrill } from '@/lib/continuity/continuityDrillService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const report = await runContinuityDrill();
    return NextResponse.json({ ok: report.result === 'pass', continuityDrill: report }, { status: report.result === 'pass' ? 200 : 503 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'continuity_drill_failed' }, { status: 500 });
  }
}
