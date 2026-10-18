import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export async function GET() {
  const unixMs = Date.now();
  return NextResponse.json({ unixMs, unixSeconds: Math.floor(unixMs / 1000), utc: new Date(unixMs).toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
}
