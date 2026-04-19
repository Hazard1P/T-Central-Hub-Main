import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decryptJson } from '@/lib/security';
import { persistPlayerReport } from '@/lib/serverPersistence';

async function getReporter() {
  const cookieStore = cookies();
  const raw = cookieStore.get('steam_session')?.value;
  try {
    return raw ? decryptJson(raw) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    publicMeta: {
      allowedReasons: [
        'Cheating or unfair advantage',
        'Griefing or sabotage',
        'Harassment or abuse',
        'Bug or exploit misuse',
        'Impersonation or false identity',
        'Other rule violation',
      ],
      reportColumns: [
        'Reported player',
        'Server or location',
        'Reason',
        'Evidence or notes',
      ],
    },
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body?.reportedPlayer || !body?.reason || !body?.evidence) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const user = await getReporter();
  const reference = `TC-${Date.now().toString(36).toUpperCase()}`;
  const report = {
    reference,
    reporter: user
      ? { steamid: user.steamid, personaname: user.personaname || null }
      : null,
    reportedPlayer: String(body.reportedPlayer).trim().slice(0, 120),
    server: String(body.server || 'T-Central Hub').trim().slice(0, 120),
    reason: String(body.reason).trim().slice(0, 500),
    evidence: String(body.evidence).trim().slice(0, 5000),
    createdAt: new Date().toISOString(),
    source: 'report-player',
  };

  const persistence = await persistPlayerReport(report);
  if (!persistence.ok) {
    return NextResponse.json({
      ok: false,
      error: 'Durable report storage is not configured.',
      code: 'REPORT_STORAGE_UNAVAILABLE',
    }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    reference,
    storage: persistence.storage,
  });
}
