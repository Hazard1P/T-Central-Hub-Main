import { NextResponse } from 'next/server';
import { getPublicDysonMapAnchors } from '@/lib/publicDysonMapAnchors';

export async function GET() {
  const payload = getPublicDysonMapAnchors();

  return NextResponse.json({
    anchors: payload.anchors,
    source: payload.source,
  });
}
