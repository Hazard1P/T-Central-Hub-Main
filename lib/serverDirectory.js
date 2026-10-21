export const DIRECTORY_GAMES = {
  rust: { label: 'Rust', steamAppId: '252490', rankings: 'https://www.battlemetrics.com/servers/rust?sort=rank' },
  arma3: { label: 'Arma 3', steamAppId: '107410', rankings: 'https://www.battlemetrics.com/servers/arma3?sort=rank' },
};

export const isDirectoryGame = (game) => game === 'rust' || game === 'arma3';

export function normalizeDirectoryServers(payload, game) {
  if (!isDirectoryGame(game)) return [];
  return (Array.isArray(payload?.data) ? payload.data : []).flatMap((entry) => {
    const a = entry.attributes || {};
    const host = String(a.ip || a.address || '');
    const port = Number(a.port);
    const rank = Number(a.rank);
    const players = Number(a.players);
    if (a.status !== 'online' || !Number.isFinite(players) || players < 1 || !Number.isInteger(rank) || rank < 1 || !/^\d+$/.test(String(entry.id)) || !/^[a-zA-Z0-9.-]+$/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) return [];
    if (entry.relationships?.game?.data?.id && entry.relationships.game.data.id !== game) return [];
    return [{ id: String(entry.id), game, name: String(a.name || 'Community server').slice(0, 200), address: `${host}:${port}`, players, maxPlayers: Number.isFinite(Number(a.maxPlayers)) ? Number(a.maxPlayers) : null, rank, map: String(a.details?.map || '').slice(0, 100), country: String(a.country || '').slice(0, 2), detailsUrl: `https://www.battlemetrics.com/servers/${game}/${entry.id}` }];
  }).sort((a, b) => a.rank - b.rank).slice(0, 12);
}

// Cache across requests and coalesce concurrent clients to respect the upstream.
export function createServerDirectoryLoader({ fetchImpl = fetch, now = Date.now } = {}) {
  const cache = new Map(), pending = new Map();
  return async function load(game) {
    if (!isDirectoryGame(game)) throw new Error('Unsupported game');
    const saved = cache.get(game);
    if (saved && now() - saved.savedAt < 60000) return saved.payload;
    if (pending.has(game)) return pending.get(game);
    const task = (async () => {
      try {
        const url = new URL('https://api.battlemetrics.com/servers');
        url.search = new URLSearchParams({ 'filter[game]': game, 'filter[status]': 'online', 'filter[players][min]': '1', sort: 'rank', 'page[size]': '30' }).toString();
        const response = await fetchImpl(url, { cache: 'no-store', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
        if (!response.ok) throw new Error('Ranking feed unavailable');
        const data = await response.json();
        if (!Array.isArray(data?.data)) throw new Error('Invalid ranking response');
        const payload = { ok: true, mode: 'live', game, source: 'BattleMetrics', checkedAt: new Date(now()).toISOString(), servers: normalizeDirectoryServers(data, game) };
        cache.set(game, { savedAt: now(), payload });
        return payload;
      } catch {
        if (saved) return { ...saved.payload, mode: 'stale', error: 'The latest check failed. These are previously observed servers; activity may have changed.' };
        return { ok: false, mode: 'unavailable', game, source: 'BattleMetrics', checkedAt: null, servers: [], error: 'Live rankings are unavailable right now. Browse the current rankings directly or retry.' };
      }
    })();
    pending.set(game, task);
    try { return await task; } finally { pending.delete(game); }
  };
}
