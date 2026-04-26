'use client';

import { useState } from 'react';
import { FLIGHT_CONTROL_COPY } from '@/lib/siteContent';

export default function SystemLauncher({ onEnter }) {
  const [entering, setEntering] = useState(false);

  const handleEnter = () => {
    setEntering(true);
    window.setTimeout(() => onEnter?.(), 260);
  };

  return (
    <div className="system-launcher">
      <div className="system-launcher-shell">
        <p className="eyebrow">System launcher</p>
        <h1>Enter the live navigation layer.</h1>
        <p className="muted">
          Load the shared 3D system only when you are ready to enter the multiplayer web-game space.
        </p>

        <div className="entry-actions">
          <button className="button primary" onClick={handleEnter}>
            {entering ? 'Initializing…' : 'Launch navigation system'}
          </button>
          <a className="button secondary" href="/servers/arma3-cth">
            Arma3 CTH
          </a>
        </div>

        <div className="system-launcher-grid">
          <article className="content-card entry-panel">
            <span className="entry-panel-kicker">Movement primer</span>
            <strong>Free-fly controls</strong>
            <p>{FLIGHT_CONTROL_COPY.launchPrimer}</p>
            <p className="muted">You can free-fly immediately after launch.</p>
          </article>
          <article className="content-card entry-panel">
            <span className="entry-panel-kicker">Performance-first</span>
            <strong>Lighter first load</strong>
            <p>3D rendering waits until the user actually enters the system.</p>
          </article>
          <article className="content-card entry-panel">
            <span className="entry-panel-kicker">Live shared space</span>
            <strong>Multiplayer aware</strong>
            <p>Steam-linked users can still move into the same room and see each other in-space.</p>
          </article>
        </div>
      </div>
    </div>
  );
}
