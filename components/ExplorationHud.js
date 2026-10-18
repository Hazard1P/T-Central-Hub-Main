'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { distanceBetween, isValidRoomName } from '@/lib/exploration';
import { isInteractiveTarget } from '@/lib/flightInput';
import { gameEngine } from '@/lib/gameEngine';

export default function ExplorationHud({ telemetry, destinations, destination, onSelect, onNavigate, onFace, cruising, onCancelCruise, visited, lobbyMode, onModeChange, roomName, onRoomChange, pilots, selfId, serverStatus, graphicsQuality, onGraphicsChange, dampers, onDampersChange, onRecenter, notice, onPanelChange, seedCount = 0 }) {
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
  const nearby = pilots.filter((pilot) => pilot.id !== selfId);
  const distance = destination ? distanceBetween(telemetry.position, destination.position) : null;
  const bearing = destination && telemetry.direction ? (() => {
    const offset = destination.position.map((value, index) => value - telemetry.position[index]);
    const scale = Math.hypot(...offset) * Math.hypot(...telemetry.direction);
    return scale > .001 ? Math.round(Math.acos(Math.max(-1, Math.min(1, offset.reduce((sum, value, index) => sum + value * telemetry.direction[index], 0) / scale))) * 180 / Math.PI) : 0;
  })() : null;
  const modeLabel = lobbyMode === 'hub' ? serverStatus.connected ? 'Shared space' : serverStatus.label : 'Solo universe';
  const visibleDestinations = destinations.filter((node) => (node.label + ' ' + node.kind).toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="exploration-hud">
      <header className="exploration-toolbar">
        <Link href="/" className="exploration-home" aria-label="Leave simulation for homepage">T<span> / </span>C</Link>
        <span className="exploration-connection"><i className={serverStatus.connected && lobbyMode === 'hub' ? 'live' : ''} />{modeLabel}<small>{lobbyMode === 'hub' && serverStatus.connected ? pilots.length + ' pilot' + (pilots.length === 1 ? '' : 's') : 'Free flight'}</small></span>
        <nav aria-label="Flight tools">
          {[['explore', 'Explore'], ['crew', 'Pilots'], ['settings', 'Settings']].map(([key, label]) => <button key={key} type="button" aria-expanded={panel === key} aria-controls="exploration-panel" onClick={() => toggle(key)}>{label}</button>)}
          <button type="button" onClick={() => gameEngine.setHUDVisible(false)} aria-label="Hide HUD">Hide<span className="exploration-key"> H</span></button>
        </nav>
      </header>

      {panel ? (
        <section className="exploration-panel" id="exploration-panel" aria-labelledby="exploration-panel-title" ref={panelRef} tabIndex={-1}>
          <div className="exploration-panel-heading"><div><p className="eyebrow">Flight tools</p><h2 id="exploration-panel-title">{panel === 'explore' ? 'Find your next horizon.' : panel === 'crew' ? 'Explore together.' : 'Your flight setup.'}</h2></div><button type="button" aria-label="Close flight panel" onClick={() => setPanel(null)}>×</button></div>
          {panel === 'explore' ? <>
            <p className="exploration-help">Choose a landmark. Cruise flies there using your ship’s thrusters; steering or dragging space returns control to you.</p>
            <label className="exploration-search">Find a destination<input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Planet, station, blackhole…" /></label>
            <div className="exploration-destinations">
              {visibleDestinations.map((node) => <button key={node.key} className={node.key === destination?.key ? 'selected' : ''} onClick={() => onSelect(node)} aria-pressed={node.key === destination?.key}>
                <span className="exploration-dot" style={{ background: node.color || '#83ebff' }} />
                <span><strong>{node.label}</strong><small>{node.kind} {visited.includes(node.key) ? '· discovered' : ''}</small></span>
                <small>{distanceBetween(telemetry.position, node.position).toFixed(0)} u</small>
              </button>)}
              {!visibleDestinations.length ? <p className="exploration-help">No destinations match. Try another name.</p> : null}
            </div>
            {destination ? <div className="exploration-selection"><h3>{destination.label}</h3><p>{destination.description}</p><div className="exploration-actions"><button className="button primary" onClick={() => { onNavigate(); setPanel(null); }}>Cruise to destination</button><button className="button secondary" onClick={() => { onFace(); setPanel(null); }}>Face destination</button></div></div> : null}
          </> : null}
          {panel === 'crew' ? <>
            <p className="exploration-help">Fly solo, or join a shared room to see other pilots and travel together. Anyone with the room name can join.</p>
            <div className="exploration-actions"><button aria-pressed={lobbyMode === 'hub'} onClick={() => onModeChange('hub')}>Shared universe</button><button aria-pressed={lobbyMode === 'private'} onClick={() => onModeChange('private')}>Solo universe</button></div>
            {lobbyMode === 'hub' ? <>
              <form className="exploration-room" onSubmit={(event) => { event.preventDefault(); if (isValidRoomName(roomDraft.trim())) onRoomChange(roomDraft.trim()); }}>
                <label>Room name<input value={roomDraft} onChange={(event) => setRoomDraft(event.target.value)} maxLength={64} pattern="(?:[a-zA-Z0-9_]|-){1,64}" required aria-describedby="room-help" /></label><button type="submit">Join room</button>
              </form>
              <p className="exploration-help" id="room-help">Use letters, numbers, dashes or underscores. Give friends the same room name or invite link.</p>
              <button type="button" className="button secondary" onClick={copyInvite}>Copy invite link</button><p className="exploration-feedback" role="status">{copyStatus}</p>
              <h3>{serverStatus.connected ? pilots.length + ' pilot' + (pilots.length === 1 ? '' : 's') + ' in this room' : serverStatus.label + '…'}</h3>
              <ul className="exploration-pilots">{pilots.map((pilot) => <li key={pilot.id}><span>{pilot.displayName}{pilot.id === selfId ? ' (you)' : ''}</span>{pilot.id !== selfId ? <button onClick={() => { onSelect({ key: 'pilot:' + pilot.id, label: pilot.displayName, kind: 'pilot waypoint', position: [...pilot.position], approachRadius: 4, description: 'Last shared location of this pilot. Select them again to update the waypoint.' }); setPanel(null); }}>Set waypoint · {distanceBetween(telemetry.position, pilot.position).toFixed(0)} u</button> : <small>Flying</small>}</li>)}</ul>
              {!nearby.length ? <p className="exploration-help">The universe is open. Invite a friend to fly alongside you.</p> : null}
            </> : <p className="exploration-help">Your solo flight is isolated from shared room traffic. Switch back to rejoin other pilots.</p>}
          </> : null}
          {panel === 'settings' ? <>
            <label className="exploration-setting">Visual quality<select value={graphicsQuality} onChange={(event) => onGraphicsChange(event.target.value)}><option value="auto">Auto</option><option value="high">High</option><option value="performance">Performance</option></select></label>
            <label className="exploration-check"><input type="checkbox" checked={dampers} onChange={onDampersChange} />Brake automatically when thrust is released</label>
            <button className="button secondary" onClick={onRecenter}>Recenter view</button>
            <div className="exploration-controls"><h3>Flight controls</h3><p>W / S forward and back · A / D strafe<br />Space / R rise · Shift / F descend<br />Ctrl boost · X brake<br />Drag space to look · M destinations · H hide HUD</p><p>On touch screens, use the flight pad and drag the open scene to look around.</p></div>
            <Link className="exploration-account-link" href="/">Account and sign-in on the homepage</Link>
            {seedCount > 0 ? <Link className="exploration-account-link" href="/profile">Your Prayer Seed collection · {seedCount}</Link> : null}
          </> : null}
        </section>
      ) : null}

      <div className="exploration-flight-strip" aria-label="Flight telemetry">
        <span><small>Speed</small><strong>{telemetry.speed.toFixed(1)} <small>u/s</small></strong></span>
        {destination ? <span className="exploration-target"><small>{cruising ? 'Cruising to' : 'Waypoint'}</small><strong>{destination.label}</strong><small>{distance.toFixed(1)} u {bearing !== null ? '· ' + bearing + '° off nose' : ''}</small></span> : <span className="exploration-target"><small>Free flight</small><strong>Choose a destination to begin</strong></span>}
        {cruising ? <button type="button" onClick={onCancelCruise}>Cancel cruise</button> : <button type="button" onClick={() => toggle('explore')}>Destinations</button>}
      </div>
      <p className="exploration-notice" role="status">{notice}</p>
    </div>
  );
}
