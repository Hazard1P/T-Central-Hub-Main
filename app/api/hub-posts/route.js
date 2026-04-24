import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';
import { listHubPosts, persistHubPost } from '@/lib/serverPersistence';

export async function GET() {
  const records = await listHubPosts();
  return NextResponse.json({ ok: true, posts: records.slice(0, 40) });
}

export async function POST(request) {
  const auth = resolveGameAuthContext(cookies());
  if (auth.provider !== 'steam' || !auth.steamUser?.steamid) {
    return NextResponse.json({ ok: false, error: 'Steam authentication is required to post on the hub board.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const topic = String(body?.topic || '').trim().slice(0, 120);
  const category = String(body?.category || 'General').trim().slice(0, 80);
  const message = String(body?.message || '').trim().slice(0, 3000);

  if (!topic || !message) {
    return NextResponse.json({ ok: false, error: 'Topic and message are required.' }, { status: 400 });
  }

  const reference = `HB-${Date.now().toString(36).toUpperCase()}`;
  const record = {
    reference,
    topic,
    category,
    message,
    createdAt: new Date().toISOString(),
    author: {
      steamid: String(auth.steamUser.steamid),
      personaname: auth.steamUser.personaname || 'Steam Pilot',
      avatar: auth.steamUser.avatar || null,
      profileurl: auth.steamUser.profileurl || null,
    },
    source: 'hub-community-form',
  };

  const persistence = await persistHubPost(record);
  if (!persistence.ok) {
    return NextResponse.json({ ok: false, error: 'Durable post storage is not configured.', code: 'HUB_POST_STORAGE_UNAVAILABLE' }, { status: 503 });
  }

  return NextResponse.json({ ok: true, reference, storage: persistence.storage });
}
