'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DIRECTORY_GAMES, isDirectoryGame } from '@/lib/serverDirectory';
import ServerConnectActions from '@/components/ServerConnectActions';

export default function ServerDirectory({ initialGame = 'rust' }) {
  const params = useSearchParams();
  const game = isDirectoryGame(params.get('game')) ? params.get('game') : initialGame;
  const [activeGame, setActiveGame] = useState(game);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState(null);
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const sequence = useRef(0);
  useEffect(() => { setActiveGame(game); }, [game]);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) setRevision((value) => value + 1); }, 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const ticket = ++sequence.current;
    const controller = new AbortController();
    setLoading(true);
    setResult((previous) => previous?.game === activeGame ? previous : null);
    fetch(`/api/server-directory?game=${activeGame}`, { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (ticket === sequence.current) { setResult(data); setSelection((previous) => data.servers?.find((server) => server.id === previous?.id) || data.servers?.[0] || null); }
    }).catch((error) => {
      if (error.name !== 'AbortError' && ticket === sequence.current) setResult({ game: activeGame, mode: 'unavailable', error: 'Unable to load rankings. Try the direct rankings below.', servers: [] });
    }).finally(() => { if (ticket === sequence.current) setLoading(false); });
    return () => controller.abort();
  }, [activeGame, revision]);
  const current = DIRECTORY_GAMES[activeGame];
  const servers = (result?.servers || []).filter((server) => `${server.name} ${server.map} ${server.country}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <section className="server-directory" aria-labelledby="directory-title">
      <div className="content-card directory-intro">
        <p className="eyebrow">Independent communities</p><h2 id="directory-title">Find a server with people playing</h2>
        <p>T-Central does not currently operate active Rust or Arma 3 servers. Discover third-party servers here, ranked by BattleMetrics and filtered to servers reporting online with players.</p>
        <div className="directory-toolbar">
          <div className="directory-game-switch" aria-label="Choose game">{Object.entries(DIRECTORY_GAMES).map(([key, item]) => <button key={key} type="button" className={`button ${activeGame === key ? 'primary' : 'secondary'}`} aria-pressed={activeGame === key} onClick={() => { setActiveGame(key); setSearch(''); setSelection(null); }}>{item.label}</button>)}</div>
          <label>Search servers<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, map or country" /></label>
          <button className="button secondary" type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>{loading ? 'Checking…' : 'Refresh servers'}</button>
        </div>
        <p className="muted" role="status">{loading ? 'Checking the latest rankings…' : result?.mode === 'live' ? `Source: BattleMetrics · Checked ${new Date(result.checkedAt).toLocaleString()} · Refreshes every minute.` : result?.error}</p>
        <a className="button secondary" href={current.rankings} target="_blank" rel="noreferrer">View current {current.label} rankings ↗</a>
      </div>
      <div className="directory-layout">
        <div className="directory-list" aria-label={`${current.label} servers`}>
          {servers.map((server) => <button className={`content-card directory-server ${selection?.id === server.id ? 'is-selected' : ''}`} type="button" key={server.id} aria-pressed={selection?.id === server.id} onClick={() => setSelection(server)}>
            <span className="eyebrow">{result.mode === 'stale' ? 'Last observed' : 'BattleMetrics'} rank #{server.rank}</span><strong>{server.name}</strong><span>{server.players}{server.maxPlayers ? ` / ${server.maxPlayers}` : ''} players · {server.country || 'Global'}</span>{server.map ? <small>{server.map}</small> : null}<span className="directory-select-hint">Select for connection options</span>
          </button>)}
          {!loading && !servers.length ? <div className="content-card"><h3>{result?.mode === 'unavailable' ? 'Browse directly while rankings reconnect' : 'No matching active servers'}</h3><p className="muted">{search ? 'Try a different name or clear your search.' : 'Activity changes throughout the day. Open the provider rankings for more choices.'}</p></div> : null}
        </div>
        <section className="content-card directory-detail" aria-label="Selected server">
          <p className="eyebrow">{current.label} · Third-party server</p><h3>{selection?.name || 'Choose a server'}</h3>
          {selection && selection.game === activeGame ? <>
            <p className="directory-address">{selection.address}</p><p>{selection.players} players reported at the last check. {selection.map ? `Map: ${selection.map}.` : ''}</p>
            <ServerConnectActions serverIp={selection.address} steamAppId={current.steamAppId} launchLabel={`Launch ${current.label}`} connectLabel="Connect through Steam" />
            <a href={selection.detailsUrl} target="_blank" rel="noreferrer">View server details and history ↗</a>
          </> : <p className="muted">Select a ranked server to see its address, copy it or connect through Steam. Direct ranking links remain available when the feed is down.</p>}
          <p className="muted">Independent operators set their own rules, mods and access requirements. Rankings and player counts can change; a listing is not an endorsement or a guaranteed place. Steam links require a supported desktop setup; on a phone, use the details link or copy the address.</p>
        </section>
      </div>
    </section>
  );
}
