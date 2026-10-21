import { createServerDirectoryLoader, isDirectoryGame } from '@/lib/serverDirectory';

export const dynamic = 'force-dynamic';
const load = createServerDirectoryLoader();

export async function GET(request) {
  const game = new URL(request.url).searchParams.get('game') || 'rust';
  if (!isDirectoryGame(game)) return Response.json({ ok: false, error: 'Choose Rust or Arma 3.' }, { status: 400 });
  return Response.json(await load(game), { headers: { 'Cache-Control': 'no-store' } });
}
