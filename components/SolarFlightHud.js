'use client';

import { useEffect, useRef, useState } from 'react';
import { SOLAR_BODIES, GEO_ALTITUDE_KM } from '@/lib/solarSystem';
import { isInteractiveTarget } from '@/lib/flightInput';
import { gameEngine } from '@/lib/gameEngine';
import { SOLAR_FLIGHT_CENTER, SOLAR_FLIGHT_RADIUS } from '@/lib/flightRegions';

export default function SolarFlightHud({ bodyId, onTravel, onReturn, clock, telemetry, lobbyMode, onModeChange, roomName, onRoomChange, pilots, serverStatus, onPanelChange, onApproach, graphicsQuality, onGraphicsChange, notice }) {
  const [panel, setPanel] = useState(null), [roomDraft, setRoomDraft] = useState(roomName);
  const section = useRef(null);
  const body = SOLAR_BODIES.find((entry) => entry.id === bodyId);
  const utc = clock.utcMs ? new Date(clock.utcMs).toISOString() : null;
  const radius = Math.hypot(...telemetry.position.map((value, axis) => value - SOLAR_FLIGHT_CENTER[axis]));
  const altitude = Math.max(0, radius - SOLAR_FLIGHT_RADIUS) * body.radiusKm / SOLAR_FLIGHT_RADIUS;
  const toggle = (key) => setPanel((current) => current === key ? null : key);
  useEffect(() => { setRoomDraft(roomName); }, [roomName]);
  useEffect(() => { onPanelChange(Boolean(panel)); if (panel) section.current?.focus(); return () => onPanelChange(false); }, [panel, onPanelChange]);
  useEffect(() => {
    const key = (event) => {
      if (event.code === 'Escape') { setPanel(null); return; }
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || isInteractiveTarget(event.target)) return;
      if (event.code === 'KeyM') { event.preventDefault(); toggle('explore'); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  return <div className="exploration-hud solar-flight-hud">
    <header className="exploration-toolbar solar-flight-toolbar">
      <button type="button" className="solar-flight-back" onClick={onReturn}>← Universe</button>
      <span className="exploration-connection"><i className={serverStatus.connected && lobbyMode === 'hub' ? 'live' : ''} />Sol · {body.name}<small>{lobbyMode === 'hub' ? serverStatus.connected ? pilots.length + ' pilots in this orbit' : serverStatus.label : 'Solo flight'}</small></span>
      <nav aria-label="Flight tools">{[['explore', 'Explore'], ['crew', 'Pilots'], ['settings', 'Settings']].map(([id, label]) => <button key={id} aria-expanded={panel === id} aria-controls="solar-flight-panel" onClick={() => toggle(id)}>{label}</button>)}<button onClick={() => gameEngine.setHUDVisible(false)} aria-label="Hide HUD">Hide</button></nav>
    </header>
    {panel ? <section className="exploration-panel solar-flight-panel" id="solar-flight-panel" ref={section} tabIndex={-1} aria-labelledby="solar-flight-title">
      <div className="exploration-panel-heading"><h2 id="solar-flight-title">{panel === 'explore' ? 'Fly our Solar System.' : panel === 'crew' ? 'Meet in the same orbit.' : 'Your flight setup.'}</h2><button aria-label="Close flight panel" onClick={() => setPanel(null)}>×</button></div>
      {panel === 'explore' ? <>
        <p className="exploration-help">Warp between planetary regions, then fly your ship with the same controls. Orbital positions, orientation and lighting follow live UTC.</p>
        <div className="solar-flight-worlds">{SOLAR_BODIES.map((entry) => <button key={entry.id} onClick={() => { onTravel(entry.id); setPanel(null); }} aria-pressed={bodyId === entry.id}><i style={{ background: entry.color }} /><span>{entry.name}<small>{entry.type}</small></span><span>{bodyId === entry.id ? 'Here' : 'Warp →'}</span></button>)}</div>
        <h3>{body.name}</h3><p className="exploration-help">{body.description}</p>
        <button className="button secondary" onClick={() => { onApproach(); setPanel(null); }}>Cruise to {body.name}</button>
        {body.id === 'earth' ? <p className="exploration-help">The GEO beacon follows a geostationary equatorial orbit at {Math.round(GEO_ALTITUDE_KM).toLocaleString('en-US')} km. Fly around Earth to find it.</p> : null}
        <p className="exploration-help">{utc?.slice(0, 19).replace('T', ' ')} UTC · {clock.source}</p>
      </> : panel === 'crew' ? <>
        <p className="exploration-help">Use the same room and choose the same planet to fly together. Planetary regions keep their own local coordinates.</p>
        <div className="exploration-actions"><button aria-pressed={lobbyMode === 'hub'} onClick={() => onModeChange('hub')}>Shared universe</button><button aria-pressed={lobbyMode === 'private'} onClick={() => onModeChange('private')}>Solo universe</button></div>
        <form className="exploration-room" onSubmit={(event) => { event.preventDefault(); onRoomChange(roomDraft.trim()); }}><label>Room name<input required maxLength={64} pattern="(?:[a-zA-Z0-9_]|-){1,64}" value={roomDraft} onChange={(event) => setRoomDraft(event.target.value)} /></label><button>Join room</button></form>
        <ul className="exploration-pilots">{pilots.map((pilot) => <li key={pilot.id}>{pilot.displayName}</li>)}</ul>
      </> : <>
        <label className="exploration-setting">Visual quality<select value={graphicsQuality} onChange={(event) => onGraphicsChange(event.target.value)}><option value="auto">Auto</option><option value="high">High</option><option value="performance">Performance</option></select></label>
        <div className="exploration-controls"><h3>Ship controls</h3><p>Move the mouse to steer · click and hold to fire<br />WASD / arrows thrust · Space / Shift vertical<br />Ctrl boost · X brake · V fire<br />Esc releases the mouse · M destinations · H HUD</p><p>On phones, drag open space to steer and hold the flight pad and Fire button with separate fingers.</p></div>
        <p className="exploration-help">Planet-local scale: 1 u ≈ {Math.round(body.radiusKm / SOLAR_FLIGHT_RADIUS).toLocaleString('en-US')} km. Flight assist maintains a safe surface boundary. Long-distance travel uses warp.</p>
      </>}
    </section> : null}
    <div className="exploration-flight-strip solar-flight-strip"><span><small>Speed</small><strong>{telemetry.speed.toFixed(1)} <small>u/s</small></strong></span><span className="exploration-target"><small>{body.name} · altitude</small><strong>{Math.round(altitude).toLocaleString('en-US')} km</strong><small>Live UTC · Cannons ready</small></span><button onClick={() => toggle('explore')}>Destinations</button></div>
    <p className="exploration-notice" role="status">{notice}</p>
  </div>;
}
