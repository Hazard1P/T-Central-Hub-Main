export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { hasDurableMultiplayer, runSymmetryValidator } from '@/lib/durableMultiplayerStore';

function authorize(request) {
  const auth = request.headers.get('x-cron-secret');
  return !process.env.CRON_SECRET || auth === process.env.CRON_SECRET;
}

async function handle(request, payload = {}) {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (!hasDurableMultiplayer()) {
    return NextResponse.json({ ok: false, error: 'DURABLE_MULTIPLAYER_UNAVAILABLE' }, { status: 503 });
  }

  const result = await runSymmetryValidator({
    roomName: payload?.roomName,
    fromTimestamp: payload?.from,
    toTimestamp: payload?.to,
    limit: payload?.limit,
  });

  return NextResponse.json(result, { status: result.status || 200 });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  return handle(request, {
    roomName: searchParams.get('roomName') || undefined,
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
    limit: searchParams.get('limit') || undefined,
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  return handle(request, body || {});
}
