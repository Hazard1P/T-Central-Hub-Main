import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

const metadataPath = path.join(process.cwd(), 'public', 'reports', 'entropy-release-latest.meta.json');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const raw = await fs.readFile(metadataPath, 'utf8');
    const metadata = JSON.parse(raw);

    return NextResponse.json({
      url: metadata?.url || '/reports/entropy-release-latest.pdf',
      sha256: metadata?.sha256 || null,
      generatedAt: metadata?.generatedAt || null,
    });
  } catch (error) {
    return NextResponse.json({
      url: '/reports/entropy-release-latest.pdf',
      sha256: null,
      generatedAt: null,
      error: 'entropy release metadata not generated',
    }, { status: 404 });
  }
}
