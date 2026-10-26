import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';
import { accountUsernames } from '@/lib/server/accountUsernameStore';
import { isSameOriginPaymentRequest } from '@/lib/paymentRequest';
import { normalizeGamertag } from '@/lib/accountUsername';
import { hasRealtimeServer, realtimeCall } from '@/lib/server/realtimeBridge';

export const dynamic = 'force-dynamic';
const reply = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
const failure = error => reply({ ok: false, error: error.message, code: error.code, nextChangeAt: error.nextChangeAt }, error.status || 503);
export async function GET() {
  try { return reply(await accountUsernames().read(resolveGameAuthContext(cookies()))); }
  catch (error) { return failure(error); }
}
export async function POST(request) {
  if (!isSameOriginPaymentRequest(request)) return reply({ ok: false, error: 'Same-origin requests required.' }, 403);
  const auth = resolveGameAuthContext(cookies());
  if (!auth.authenticated) return reply({ ok: false, error: 'Sign in to change your username.' }, 401);
  if (auth.provider !== 'google') return reply({ ok: false, error: 'Your Steam profile controls your username.' }, 403);
  const body = await request.json().catch(() => null);
  let username;
  try { username = normalizeGamertag(body?.username); }
  catch (error) { return reply({ ok: false, error: error.message }, 400); }
  try {
    const profile = await accountUsernames().update(auth, username);
    // A committed rename survives a temporary game-service outage. A later join
    // also resolves the durable name; active flights need no disconnect or reset.
    if (hasRealtimeServer()) await realtimeCall('identity', { id: `${auth.provider}:${auth.accountId}`, displayName: profile.username });
    return reply(profile);
  }
  catch (error) { return failure(error); }
}
