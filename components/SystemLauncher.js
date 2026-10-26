'use client';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSteamSession } from './SteamSessionProvider';
import { FLIGHT_CONTROL_COPY } from '@/lib/siteContent';

export default function SystemLauncher({ onEnter }) {
  const { steamUser, googleUser, loading, sessionError, refresh } = useSteamSession();
  const [lobby, setLobby] = useState(null);
  const [config, setConfig] = useState(null);
  const [authMessage, setAuthMessage] = useState('');
  const [returnTo, setReturnTo] = useState('/system');
  useEffect(() => {
    const url = new URL(window.location.href);
    const room = url.searchParams.get('room');
    setReturnTo('/system' + (room ? '?room=' + encodeURIComponent(room) : ''));
    const status = url.searchParams.get('google') || url.searchParams.get('steam');
    if (status) setAuthMessage(status === 'linked' ? 'Account connected. Ready for launch.' : 'Sign-in did not finish. Please try again.');
    const roomName = room || process.env.NEXT_PUBLIC_MULTIPLAYER_ROOM || 'tcentral-main';
    let active = true;
    const checkLobby = () => fetchWithTimeout('/api/multiplayer/lobby?room=' + encodeURIComponent(roomName), { cache:'no-store' }, 6000).then(r => r.json()).then(data => { if (active) setLobby(data); }).catch(() => { if (active) setLobby({ok:false}); });
    checkLobby();
    const timer = window.setInterval(checkLobby,10000);
    fetch('/api/auth/config', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setConfig).catch(() => {});
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const user = steamUser || googleUser;
  return (
    <main className="system-launcher">
      <div className="system-launcher-shell">
        <nav className="launch-topbar" aria-label="Simulation navigation"><Link href="/" className="launch-brand">T / C <span>Space & Time</span></Link><Link href="/">Back to hub</Link></nav>
        <div className="launch-layout">
          <section className="launch-intro" aria-labelledby="launch-title">
            <p className="eyebrow">One universe. Your course.</p>
            <h1 id="launch-title">Space & Time</h1>
            <p className="launch-description">Begin near Earth. Explore a living Solar System, discover deep space and fly alongside other pilots in real-time ship combat.</p>
            <div className="launch-facts"><span>UTC orbital motion</span><span>Live multiplayer & combat</span><span>Mobile controls</span></div>
            <div className="entry-actions launch-actions">
              <button type="button" className="button primary" disabled={loading || Boolean(sessionError) || !lobby?.ok} onClick={() => onEnter?.({ mode: 'hub' })}>{lobby?.population?.full ? 'Wait for a pilot slot' : 'Join shared flight'} <span aria-hidden="true">→</span></button>
              <button type="button" className="button secondary" onClick={() => onEnter?.({ mode: 'private' })}>Fly solo</button>
            </div>
            <p className="launch-caption">{loading ? 'Checking your account…' : !lobby ? 'Checking the shared universe…' : !lobby.ok ? 'Shared flight is temporarily unavailable. Checking again shortly.' : `${lobby.population.playerCount} / ${lobby.population.capacity} pilots in this room. ${lobby.population.full ? 'Wait here or join to retry a slot.' : 'Launch together; share your room from Pilots.'}`}</p>
          </section>
          <aside className="launch-account" aria-labelledby="launch-account-title">
            <span className="entry-panel-kicker">Your pilot</span>
            <h2 id="launch-account-title">{loading ? 'Checking session…' : user ? (steamUser?.personaname || googleUser?.gamertag || 'Pilot') : 'Ready, explorer?'}</h2>
            <p>{user ? `Connected with ${steamUser ? 'Steam' : 'Google'}. Your account stays with you across flights.` : 'Guest flights are open. Sign in to keep account progress with your pilot.'}</p>
            {sessionError ? <p role="alert">{sessionError} <button onClick={refresh} type="button">Retry</button></p> : null}
            {authMessage ? <p role="status">{authMessage}</p> : null}
            {user ? <div className="launch-account-actions"><Link className="button secondary" href="/profile">View account</Link><a href={`/api/auth/${steamUser ? 'steam' : 'google'}/logout`}>Sign out</a></div> : <div className="launch-account-actions">
              {config?.steam ? <a className="button secondary" href={'/api/auth/steam/login?redirectTo=' + encodeURIComponent(returnTo)}>Continue with Steam</a> : <span className="launch-caption">Steam sign-in {config ? 'is being configured' : 'availability is being checked'}</span>}
              {config?.google ? <a className="button secondary" href={'/api/auth/google/login?redirectTo=' + encodeURIComponent(returnTo)}>Continue with Google</a> : <span className="launch-caption">Google sign-in {config ? 'is being configured' : 'availability is being checked'}</span>}
            </div>}
            <small>19+ community · <Link href="/terms-and-conditions">Terms</Link> · <Link href="/privacy-policy">Privacy</Link></small>
          </aside>
        </div>
        <section className="launch-guide" aria-label="Before you launch">
          <article><span>01 / PILOT</span><h2>Find your bearings</h2><p>{FLIGHT_CONTROL_COPY.launchPrimer}</p></article>
          <article><span>02 / EXPLORE</span><h2>Choose a waypoint</h2><p>Open Explore for planets and deep-space destinations. Cruise brings you close, then you take control.</p></article>
          <article><span>03 / UPGRADE</span><h2>Mine. Deliver. Upgrade.</h2><p>Open Shipyard to mine nearby asteroids. Deliver ore to Earth for credits and improve your cargo bay and laser.</p></article>
        </section>
      </div>
    </main>
  );
}
