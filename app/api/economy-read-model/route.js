import { NextResponse } from 'next/server';
import { getEconomyReadModel } from '@/lib/economyReadModel';

export async function GET() {
  return NextResponse.json({
    ok: true,
    as_of: new Date().toISOString(),
    data: getEconomyReadModel(),
  });
}
