'use client';

import Link from 'next/link';
import LiveCommunityChat from './LiveCommunityChat';
import ShipyardPanel from './ShipyardPanel';
import ShipSystemsReadout from './ShipSystemsReadout';
import FlightPhysicsReadout from './FlightPhysicsReadout';
import { useEffect, useRef, useState } from 'react';
import { distanceBetween, isValidRoomName } from '@/lib/exploration';
import { isInteractiveTarget } from '@/lib/flightInput';
import { formatSpaceDistance, formatFlightSpeed } from '@/lib/universeSpace';
import { gameEngine } from '@/lib/gameEngine';

export default function ExplorationHud({ telemetry, destinations, destination, onSelect, onNavigate, onFace, cruising, onCancelCruise, visited, lobbyMode, onModeChange, roomName, onRoomChange, pilots, selfId, serverStatus, graphicsQuality, onGraphicsChange, dampers, onDampersChange, onRecenter, onRespawn, respawning, notice, onPanelChange, seedCount = 0, economy, onMiningWaypoint, onEarthWaypoint, onMiningApproach, combatEvents = [], sound }) {
  const [panel, setPanel] = useState(null);
  const [filter, setFilter] = useState('');
  const [roomDraft, setRoomDraft] = useState(roomName);
  const [copyStatus, setCopyStatus] = useState('');
  const panelRef = useRef(null);
  const toggle = (value) => setPanel((current) => current === value ? null : value);
  useEffect(() => { setRoomDraft(roomName); setCopyStatus(''); }, [roomName]);
  useEffect(() => {
    const key = (event) => {
      if (event.code === 'Escape') { setPanel(null); return; }
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || isInteractiveTarget(event.target)) return;
      if (event.code === 'KeyM') { event.preventDefault(); setPanel((current) => current === 'explore' ? null : 'explore'); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => { if (panel) panelRef.current?.focus(); }, [panel]);
  useEffect(() => { onPanelChange?.(Boolean(panel)); }, [panel, onPanelChange]);

  async function copyInvite() {
    const url = new URL('/system', window.location.origin);
    url.searchParams.set('room', roomName);
    try { await navigator.clipboard.writeText(url.href); setCopyStatus('Invite link copied.'); }
    catch { setCopyStatus('Share this link: ' + url.href); }
  }
  const recentHits = combatEvents.filter(event => event.type === 'hit' && Date.now() - event.at < 500);
  const incomingHit = recentHits.some(event => event.targetId === selfId);
  const incomingHullHit = recentHits.some(event => event.targetId === selfId && event.hullDamage > 0);
  const confirmedHit = recentHits.some(event => event.ownerId === selfId);
  const combatSelf = pilots.find(pilot => pilot.id === selfId);
  const nearby = pilots.filter((pilot) => pilot.id !== selfId);
  const distance = destination ? distanceBetween(telemetry.position, destination.position) : null;
  const bearing = destination && telemetry.direction ? (() => {
    const offset = destination.position.map((value, index) => value - telemetry.position[index]);
    const scale = Math.hypot(...offset) * Math.hypot(...telemetry.direction);
    return scale > .001 ? Math.round(Math.acos(Math.max(-1, Math.min(1, offset.reduce((sum, value, index) => sum + value * telemetry.direction[index], 0) / scale))) * 180 / Math.PI) : 0;
  })() : null;
  const population = serverStatus.population;
  const populationLabel = population ? `${population.playerCount} / ${population.capacity} pilots` : pilots.length + ' pilots';
  const modeLabel = lobbyMode === 'hub' ? serverStatus.connected ? 'Shared space' : serverStatus.label : 'Solo universe';
  const visibleDestinations = destinations.filter((node) => (node.label + ' ' + node.kind).toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className={'exploration-hud' + (incomingHullHit ? ' combat-damaged' : incomingHit ? ' combat-shield-hit' : '')}>
      {confirmedHit ? <span className="combat-hit-confirm" aria-label="Hit confirmed">✛</span> : null}
      <header className="exploration-toolbar">
        <Link href="/" className="exploration-home" aria-label="Leave simulation for homepage">T<span> / </span>C</Link>
        <span className="exploration-connection"><i className={serverStatus.connected && lobbyMode === 'hub' ? 'live' : ''} />{modeLabel}<small>{lobbyMode === 'hub' && serverStatus.connected ? populationLabel + (serverStatus.transport === 'websocket' ? ' · real-time' : '') : lobbyMode === 'hub' ? 'Waiting for shared server' : 'Free flight'}</small></span>
        <nav aria-label="Flight tools">
          {[['explore', 'Explore'], ['shipyard', 'Shipyard'], ['crew', 'Pilots'], ['chat', 'Chat'], ['settings', 'Settings']].map(([key, label]) => <button key={key} type="button" aria-expanded={panel === key} aria-controls="exploration-panel" onClick={() => toggle(key)}>{label}</button>)}
          <button type="button" onClick={() => gameEngine.setHUDVisible(false)} aria-label="Hide HUD">Hide<span className="exploration-key"> H</span></button>
        </nav>
      </header>

      {panel ? (
        <section className="exploration-panel" id="exploration-panel" aria-labelledby="exploration-panel-title" ref={panelRef} tabIndex={-1}>
          <div className="exploration-panel-heading"><div><p className="eyebrow">Flight tools</p><h2 id="exploration-panel-title">{panel === 'explore' ? 'Find your next horizon.' : panel === 'crew' ? 'Explore together.' : panel === 'shipyard' ? 'Your ship & cargo' : panel === 'chat' ? 'Community chat' : 'Your flight setup.'}</h2></div><button type="button" aria-label="Close flight panel" onClick={() => setPanel(null)}>×</button></div>
          {panel === 'chat' ? <LiveCommunityChat compact /> : null}
          {panel === 'explore' ? <>
            <p className="exploration-help">Every destination is in this universe. Cruise flies continuously, building speed in open space and braking ahead of arrival; steering returns control to you.</p>
            <label className="exploration-search">Find a destination<input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Planet, station, blackhole…" /></label>
            <div className="exploration-destinations">
              {visibleDestinations.map((node) => <button key={node.key} className={node.key === destination?.key ? 'selected' : ''} onClick={() => onSelect(node)} aria-pressed={node.key === destination?.key}>
                <span className="exploration-dot" style={{ background: node.color || '#83ebff' }} />
                <span><strong>{node.label}</strong><small>{node.kind} {visited.includes(node.key) ? '· discovered' : ''}</small></span>
                <small>{formatSpaceDistance(distanceBetween(telemetry.position, node.position))}</small>
              </button>)}
              {!visibleDestinations.length ? <p className="exploration-help">No destinations match. Try another name.</p> : null}
            </div>
            {destination ? <div className="exploration-selection"><h3>{destination.label}</h3><p>{destination.description}</p><div className="exploration-actions"><button className="button primary" onClick={() => { onNavigate(); setPanel(null); }}>Cruise to destination</button><button className="button secondary" onClick={() => { onFace(); setPanel(null); }}>Face destination</button></div></div> : null}
          </> : null}
          {panel === 'crew' ? <>
            <p className="exploration-help">Shared flight includes live ship combat and exploration. Invite friends into the same room. Spawn shields last five seconds and end when you fire; destroyed ships return to Earth after five seconds.</p>
            <div className="exploration-actions"><button aria-pressed={lobbyMode === 'hub'} onClick={() => onModeChange('hub')}>Shared universe</button><button aria-pressed={lobbyMode === 'private'} onClick={() => onModeChange('private')}>Solo universe</button></div>
            {lobbyMode === 'hub' ? <>
              {serverStatus.connected && serverStatus.transport === 'websocket' ? <p className="exploration-help">The server controls flight, pulse hits, shields and respawns. Opening another flight with this account resumes it there.</p> : null}
              <form className="exploration-room" onSubmit={(event) => { event.preventDefault(); if (isValidRoomName(roomDraft.trim())) onRoomChange(roomDraft.trim()); }}>
                <label>Room name<input value={roomDraft} onChange={(event) => setRoomDraft(event.target.value)} maxLength={64} pattern="(?:[a-zA-Z0-9_]|-){1,64}" required aria-describedby="room-help" /></label><button type="submit">Join room</button>
              </form>
              <p className="exploration-help" id="room-help">Use letters, numbers, dashes or underscores. Give friends the same room name or invite link.</p>
              <button type="button" className="button secondary" onClick={copyInvite}>Copy invite link</button><p className="exploration-feedback" role="status">{copyStatus}</p>
              <h3>{serverStatus.connected ? populationLabel + ' in this room' : serverStatus.label + '…'}</h3>
              <ul className="exploration-pilots">{pilots.map((pilot) => <li key={pilot.id}><span>{pilot.displayName}{pilot.id !== selfId ? <Link className="pilot-report-link" href={'/report-player?player=' + encodeURIComponent(pilot.displayName) + (/^(google:|steam:)/.test(pilot.id) ? '&account=' + encodeURIComponent(pilot.id) : '')} target="_blank" rel="noopener noreferrer">Report player</Link> : null}{pilot.id === selfId ? ' (you)' : ''}{serverStatus.transport === 'websocket' ? <small>{pilot.kills || 0} kills · {pilot.deaths || 0} losses{pilot.alive === false ? ' · respawning' : ''}</small> : null}</span>{pilot.id !== selfId ? <button onClick={() => { onSelect({ key: 'pilot:' + pilot.id, label: pilot.displayName, kind: 'pilot waypoint', position: [...pilot.position], approachRadius: 4, description: 'Last shared location of this pilot. Select them again to update the waypoint.' }); setPanel(null); }}>Set waypoint · {distanceBetween(telemetry.position, pilot.position).toFixed(0)} u</button> : <small>Flying</small>}</li>)}</ul>
              {!nearby.length ? <p className="exploration-help">The universe is open. Invite a friend to fly alongside you.</p> : null}
            </> : <p className="exploration-help">Your solo session is isolated from shared room traffic. Switch back to rejoin other pilots.</p>}
          </> : null}
          {panel === 'shipyard' && economy ? <ShipyardPanel economy={economy} ship={combatSelf} onMiningWaypoint={() => { onMiningWaypoint(); setPanel(null); }} onEarthWaypoint={() => { onEarthWaypoint(); setPanel(null); }} onMiningApproach={(id) => { onMiningApproach(id); setPanel(null); }} /> : null}
          {panel === 'settings' ? <>
            <label className="exploration-setting">Visual quality<select value={graphicsQuality} onChange={(event) => onGraphicsChange(event.target.value)}><option value="auto">Auto · adapts to your screen</option><option value="high">High</option><option value="performance">Performance</option></select></label>
            <p className="exploration-help">Auto adjusts resolution as your screen or rendering performance changes. Touch flight works in portrait and landscape.</p>
            {sound ? <fieldset className="exploration-audio" disabled={!sound.supported} aria-describedby="ship-audio-help">
              <legend>Sound</legend>
              <label className="exploration-check"><input type="checkbox" checked={sound.settings.muted} onChange={(event) => sound.change({ muted: event.target.checked })} />Mute all sound</label>
              <label className="exploration-volume" htmlFor="ship-effects-volume"><span>Firing effects <output>{Math.round(sound.settings.effects * 100)}%</output></span><input id="ship-effects-volume" type="range" min="0" max="100" step="1" value={Math.round(sound.settings.effects * 100)} disabled={sound.settings.muted} onChange={(event) => sound.change({ effects: Number(event.target.value) / 100 })} /></label>
              <label className="exploration-volume" htmlFor="ship-hum-volume"><span>Universe hum <output>{Math.round(sound.settings.hum * 100)}%</output></span><input id="ship-hum-volume" type="range" min="0" max="100" step="1" value={Math.round(sound.settings.hum * 100)} disabled={sound.settings.muted} onChange={(event) => sound.change({ hum: Number(event.target.value) / 100 })} /></label>
              <p className="exploration-help" id="ship-audio-help">{sound.supported ? 'The hum starts very quietly. Sound begins after a tap or key press and pauses in background tabs. Your choices are saved on this device.' : 'Sound is unavailable in this browser. Flight controls still work.'}</p>
            </fieldset> : null}
            <label className="exploration-check"><input type="checkbox" checked={dampers} onChange={onDampersChange} />Brake automatically when thrust is released</label>
            <FlightPhysicsReadout telemetry={telemetry} />
            <div className="exploration-actions"><button className="button secondary" onClick={onRecenter}>Recenter view</button><button className="button secondary" onClick={onRespawn} disabled={respawning}>{respawning ? 'Returning…' : economy?.data?.wallet?.cargo ? 'Return to Earth · discard cargo' : 'Return to Earth'}</button></div>
            <p className="exploration-help">Emergency return discards carried ore. Credits and installed upgrades remain saved.</p>
            <div className="exploration-controls"><h3>Flight controls</h3><p>W / S forward and back · A / D strafe<br />Space / R rise · Shift / F descend<br />Ctrl boost · X brake<br />Move mouse to steer · Click / V fire · Esc release mouse · M destinations · H hide HUD</p><p>Precision, Transit and Deep space assist blend automatically. Boost builds speed faster; approach braking and X/Brake retain stopping power when leaving fast travel.</p><p>On touch screens, use the flight pad and drag the open scene to look around.</p></div>
            <Link className="exploration-account-link" href="/">Account and sign-in on the homepage</Link>
            {seedCount > 0 ? <Link className="exploration-account-link" href="/profile">Your Prayer Seed collection · {seedCount}</Link> : null}
          </> : null}
        </section>
      ) : null}

      <div className="exploration-flight-strip" aria-label="Flight telemetry">
        <span><small>Speed</small><strong>{formatFlightSpeed(telemetry.speed)} <small>u/s</small></strong><small>{telemetry.travelMode || 'Precision'}</small></span>
        {destination ? <span className="exploration-target"><small>{cruising ? 'Cruising to' : 'Waypoint'}</small><strong>{destination.label}</strong><small>{formatSpaceDistance(distance)} {bearing !== null ? '· ' + bearing + '° off nose' : ''}</small></span> : <span className="exploration-target"><small>Free flight</small><strong>Choose a destination to begin</strong></span>}
        {cruising ? <button type="button" onClick={onCancelCruise}>Cancel cruise</button> : <button type="button" onClick={() => toggle('explore')}>Destinations</button>}
      </div>
      {serverStatus.transport === 'websocket' && combatSelf ? <ShipSystemsReadout ship={combatSelf} /> : null}
      {economy?.data ? <button className="ship-cargo-pill" onClick={() => toggle('shipyard')} aria-label="Open shipyard and cargo">{economy.data.wallet.cargo}/{economy.data.stats.capacity} ore <span>·</span> {economy.data.wallet.credits} cr
        {economy.miningFeedback && Date.now() - economy.miningFeedback.at < 3000 ? <small role="status">{economy.miningFeedback.message}</small> : economy.data.location.canMine ? <small>Rock in range · aim and fire</small> : null}
      </button> : null}
      <p className="exploration-notice" role="status">{notice}</p>
    </div>
  );
}
