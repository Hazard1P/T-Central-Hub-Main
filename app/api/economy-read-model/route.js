import { NextResponse } from 'next/server';
import { getEconomyReadModel } from '@/lib/economyReadModel';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    as_of: new Date().toISOString(),
    data: getEconomyReadModel(),
  });
}
