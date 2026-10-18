'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import SolarSystemScene from '@/components/SolarSystemScene';
import useSolarClock from '@/components/useSolarClock';
import { GEO_ALTITUDE_KM, SIDEREAL_DAY_SECONDS, SOLAR_BODIES, solarBodyPosition } from '@/lib/solarSystem';
import { isInteractiveTarget } from '@/lib/flightInput';

const renderer = { antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 };
const camera = { position: [0, 20, 55], fov: 42, near: .000000001, far: 400 };

export default function SolarSystemExplorer() {
  const clock = useSolarClock();
  const [selection, setSelection] = useState('earth');
  const [panel, setPanel] = useState(null);
  const [enhanced, setEnhanced] = useState(false);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [geoLongitude, setGeoLongitude] = useState(0);
  const [hud, setHud] = useState(true);
  const [cameraTick, setCameraTick] = useState(0);
  const [dateDraft, setDateDraft] = useState('');
  const [dateError, setDateError] = useState('');
  const [mobile, setMobile] = useState(false);
  const [webglError, setWebglError] = useState(false);
  const renderEnhanced = enhanced && selection === 'overview';
  useEffect(() => {
    const media = window.matchMedia('(max-width: 820px), (pointer: coarse)');
    const update = () => setMobile(media.matches); update(); media.addEventListener('change', update);
    const key = (event) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Escape') { setPanel(null); return; }
      if (isInteractiveTarget(event.target)) return;
      if (event.key.toLowerCase() === 'h') { event.preventDefault(); setHud((current) => !current); }
    };
    window.addEventListener('keydown', key);
    return () => { media.removeEventListener('change', update); window.removeEventListener('keydown', key); };
  }, []);
  const body = SOLAR_BODIES.find((entry) => entry.id === (selection === 'geo' ? 'earth' : selection));
  const time = clock.utcMs;
  const utc = time ? new Date(time).toISOString() : null;
  const distance = time && body ? Math.hypot(...solarBodyPosition(body.id, time)) : null;
  const toggle = (value) => setPanel((current) => current === value ? null : value);
  const select = (value) => {
    setSelection(value);
    if (value === 'geo') setEnhanced(false);
    setPanel(null);
  };

  return <main className="solar-system-explorer" aria-label="Interactive Solar System">
    <h1 className="solar-sr-only">Our Solar System</h1>
    <div className="solar-canvas" aria-label="Solar System in three dimensions">
      {webglError ? <div className="solar-webgl-fallback" role="alert"><h2>The 3D view could not start.</h2><p>Enable hardware acceleration or try another browser. Your account is unaffected.</p><Link className="button secondary" href="/system">Return to the universe</Link></div> : <Canvas camera={camera} gl={renderer} dpr={mobile ? [1, 1.2] : [1, 1.6]} fallback={<p className="solar-webgl-fallback">This view requires WebGL. <Link href="/system">Return to the universe</Link></p>} onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); setWebglError(true); }, { once: true }); }}>
        <SolarSystemScene clock={clock} selection={selection} onSelect={select} enhanced={renderEnhanced} showOrbits={showOrbits} showMarkers={showMarkers} geoLongitude={geoLongitude} cameraTick={cameraTick} segments={mobile ? 48 : 96} />
      </Canvas>}
    </div>

    {hud ? <>
      <header className="solar-toolbar">
        <Link href="/system" className="solar-back" aria-label="Return to the universe">← <span>Universe</span></Link>
        <div className="solar-identity"><span className="eyebrow">SOL <i /> Our Solar System</span><time dateTime={utc || undefined}>{utc ? utc.slice(0, 19).replace('T', ' ') + ' UTC' : 'Synchronizing UTC…'}</time></div>
        <nav aria-label="Solar System tools">{[['time', clock.live ? 'Live time' : clock.rate === 0 ? 'Paused' : clock.rate === 86400 ? '1 day/s' : clock.rate === 2592000 ? '30 days/s' : clock.rate + '×'], ['view', 'View'], ['details', 'Details']].map(([id, label]) => <button key={id} aria-expanded={panel === id} aria-controls="solar-panel" onClick={() => toggle(id)}>{id === 'time' ? <i className={clock.live ? 'solar-live-dot' : ''} /> : null}{label}</button>)}<button aria-label="Hide Solar System HUD" onClick={() => setHud(false)}>Hide</button></nav>
      </header>
      {panel ? <section className="solar-panel" id="solar-panel" aria-labelledby="solar-panel-title">
        <div className="solar-panel-heading"><h2 id="solar-panel-title">{panel === 'time' ? 'Travel through time.' : panel === 'view' ? 'Choose your perspective.' : selection === 'overview' ? 'Our planetary neighborhood.' : selection === 'geo' ? 'In step with Earth.' : body.name}</h2><button aria-label="Close Solar System panel" onClick={() => setPanel(null)}>×</button></div>
        {panel === 'time' ? <>
          <p>Live time follows {clock.source === 'Server UTC' ? 'the server’s UTC clock' : clock.source === 'Syncing clock' ? 'UTC, with clock synchronization in progress' : 'your device clock while synchronization is unavailable'}. Pause or choose another date to explore.</p>
          <div className="solar-actions"><button onClick={clock.goLive} aria-pressed={clock.live}>Return to live UTC</button><button onClick={() => clock.setRate(0)} aria-pressed={!clock.live && clock.rate === 0}>Pause</button></div>
          <label>Time speed<select value={clock.rate} onChange={(event) => clock.setRate(Number(event.target.value))}><option value={0}>Paused</option><option value={1}>1× real time</option><option value={60}>1 minute per second</option><option value={3600}>1 hour per second</option><option value={86400}>1 day per second</option><option value={2592000}>30 days per second</option></select></label>
          <form onSubmit={(event) => { event.preventDefault(); try { if (!dateDraft) return; clock.setDate(new Date(dateDraft + 'Z')); setDateError(''); } catch (error) { setDateError(error.message); } }}>
            <label>Explore a date (UTC)<input type="datetime-local" min="1700-01-01T00:00" max="2200-12-31T23:59" value={dateDraft} onChange={(event) => setDateDraft(event.target.value)} required /></label><button type="submit">Set date and pause</button><p role="alert">{dateError}</p>
          </form>
          <p className="solar-fine-print">UTC is converted internally by the ephemeris model. Date exploration is local to your view.</p>
        </> : panel === 'view' ? <>
          <p>Drag to orbit. Scroll or pinch to zoom. Choose any world below to travel to it.</p>
          <div className="solar-actions"><button onClick={() => select('overview')}>Whole system</button><button onClick={() => setCameraTick((value) => value + 1)}>Recenter camera</button></div>
          <label><input type="checkbox" checked={showOrbits} onChange={(event) => setShowOrbits(event.target.checked)} /> Show orbital paths</label>
          <label><input type="checkbox" checked={showMarkers} onChange={(event) => setShowMarkers(event.target.checked)} /> Show names in system overview</label>
          <label><input type="checkbox" checked={enhanced} onChange={(event) => { setEnhanced(event.target.checked); setSelection('overview'); }} /> Enlarge bodies 100× in the overview</label>
          <p className="solar-fine-print">{renderEnhanced ? 'Overview body radii are enlarged 100×, except the Sun. Distances and orbital timing retain their physical scale. Approaching a world returns to physical scale.' : 'Physical scale: distances and body radii use the same astronomical-unit scale. Small worlds can be invisible from the whole-system view; use their names to approach.'}</p>
          <button onClick={() => select('geo')}>Explore Earth’s geostationary orbit</button>
        </> : selection === 'geo' ? <>
          <p>An illustrative satellite in a circular equatorial orbit stays above the same longitude. Geostationary orbit is a special case of geosynchronous orbit.</p>
          <dl><dt>Altitude above the equator</dt><dd>{GEO_ALTITUDE_KM.toLocaleString('en-US', { maximumFractionDigits: 0 })} km</dd><dt>Orbital period</dt><dd>{SIDEREAL_DAY_SECONDS.toLocaleString('en-US')} s · one sidereal day</dd><dt>Inclination / eccentricity</dt><dd>0° / 0</dd></dl>
          <label>Fixed longitude · {geoLongitude}°<input type="range" min={-180} max={180} step={1} value={geoLongitude} onChange={(event) => setGeoLongitude(Number(event.target.value))} /></label>
          <p className="solar-fine-print">This marker demonstrates ideal GEO motion; it does not track a real spacecraft.</p>
        </> : body ? <>
          <p className="eyebrow">{body.type}</p><p>{body.description}</p><dl><dt>Mean radius</dt><dd>{body.radiusKm.toLocaleString('en-US')} km</dd><dt>Distance from the Sun now</dt><dd>{distance?.toFixed(5)} AU</dd>{body.periodDays ? <><dt>Mean orbital period{body.id === 'moon' ? ' around Earth' : ''}</dt><dd>{body.periodDays.toLocaleString('en-US')} days</dd></> : null}<dt>Sidereal rotation</dt><dd>{Math.abs(body.rotationHours).toLocaleString('en-US')} hours{body.rotationHours < 0 ? ' · retrograde' : ''}</dd></dl>
          {body.id === 'earth' ? <button onClick={() => select('geo')}>Visit geostationary orbit</button> : null}
          <p className="solar-fine-print">Calculated positions and IAU rotation axes. Earth and Moon use image maps; the other surfaces and weather are illustrative.</p>
        </> : <>
          <p>The Sun, eight planets, Earth’s Moon and dwarf planet Pluto, at the selected instant. Orbital positions include inclination and eccentricity.</p>
          <p className="solar-fine-print">Astronomy Engine 2.1.19 calculates geometric heliocentric positions. This is an approximate ephemeris model, not a complete spacecraft-grade reconstruction. Other moons, asteroids, comets and relativistic effects are not modeled.</p>
        </>}
      </section> : null}

      <div className="solar-caption"><p className="eyebrow">{selection === 'overview' ? 'The neighborhood' : selection === 'geo' ? 'Above the equator' : body.type}</p><h2>{selection === 'overview' ? 'Our Solar System.' : selection === 'geo' ? 'Geostationary orbit.' : body.name + '.'}</h2><p>{selection === 'overview' ? 'Eight planets. One shared moment.' : selection === 'geo' ? 'Always above the same place on Earth.' : body.description}</p><span>{renderEnhanced ? 'Bodies enlarged 100×' : 'Physical scale'} <b>·</b> {clock.live ? 'Live UTC' : clock.rate === 0 ? 'Time paused' : clock.rate === 1 ? '1× time preview' : 'Time accelerated'}</span></div>
      <nav className="solar-destinations" aria-label="Solar System destinations">
        <button aria-pressed={selection === 'overview'} onClick={() => select('overview')}><i className="solar-overview-icon" aria-hidden="true">◎</i><span>Overview</span></button>
        {SOLAR_BODIES.map((entry) => <button key={entry.id} aria-label={entry.name} aria-pressed={selection === entry.id} onClick={() => select(entry.id)}><i className="solar-planet-dot" aria-hidden="true" style={{ background: entry.color, '--dot-size': entry.id === 'sun' ? '22px' : entry.id === 'jupiter' ? '21px' : entry.id === 'saturn' ? '18px' : '13px' }} /><span>{entry.name}</span>{entry.type === 'dwarf planet' ? <small>Dwarf</small> : null}</button>)}
        <button aria-pressed={selection === 'geo'} onClick={() => select('geo')}><i className="solar-overview-icon" aria-hidden="true">◈</i><span>Earth GEO</span></button>
      </nav>
    </> : <button className="solar-show-hud" onClick={() => setHud(true)}>Show controls · H</button>}
  </main>;
}
