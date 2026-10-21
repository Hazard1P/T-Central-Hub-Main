import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';
import { getHubPostStorageReadiness, listHubPosts, persistHubPost } from '@/lib/serverPersistence';
import { buildHubPostRecord, publicHubPost } from '@/lib/hubPosts';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  const readiness = getHubPostStorageReadiness();
  try {
    const records = await listHubPosts();
    return NextResponse.json({ ok: true, posts: records.slice(0, 40).map(publicHubPost), ...readiness }, { headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, posts: [], ...readiness, storageConfigured: false, error: 'The community board is temporarily unavailable. Please retry shortly.' }, { status: 503, headers: noStore });
  }
}

export async function POST(request) {
  const auth = resolveGameAuthContext(cookies());
  const body = await request.json().catch(() => null);
  const builtPost = buildHubPostRecord({ body, auth });

  if (builtPost.error === 'AUTH_REQUIRED') {
    return NextResponse.json({ ok: false, error: 'Steam or Google authentication is required to post on the hub board.' }, { status: 401 });
  }

  if (builtPost.error === 'CONTENT_REQUIRED') {
    return NextResponse.json({ ok: false, error: 'Topic and message are required.' }, { status: 400 });
  }

  const { record } = builtPost;

  const persistence = await persistHubPost(record).catch(() => ({ ok: false }));
  if (!persistence.ok) {
    return NextResponse.json({ ok: false, error: 'Durable post storage is not configured.', code: 'HUB_POST_STORAGE_UNAVAILABLE' }, { status: 503 });
  }

  return NextResponse.json({ ok: true, reference: record.reference, post: publicHubPost(record), storage: persistence.storage, provider: record.author.provider }, { status: 201, headers: noStore });
}
