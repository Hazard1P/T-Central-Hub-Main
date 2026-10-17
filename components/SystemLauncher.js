'use client';

import { useState } from 'react';
import { FLIGHT_CONTROL_COPY } from '@/lib/siteContent';

export default function SystemLauncher({ onEnter }) {
  const [entering, setEntering] = useState(false);

  const handleEnter = () => {
    if (entering) return;
    setEntering(true);
    onEnter?.();
    setEntering(false);
  };

  return (
    <div className="system-launcher">
      <div className="system-launcher-shell">
        <p className="eyebrow">T-Central universe</p>
        <h1>Your next horizon starts here.</h1>
        <p className="muted">
          Fly through the hub, set a course for distant planets, or share a room with friends. You can start as a guest.
        </p>

        <div className="entry-actions">
          <button type="button" className="button primary" disabled={entering} onClick={handleEnter}>
            {entering ? 'Initializing…' : 'Launch simulation'}
          </button>
        </div>

        <div className="system-launcher-grid">
          <article className="content-card entry-panel">
            <span className="entry-panel-kicker">Movement primer</span>
            <strong>Free-fly controls</strong>
            <p>{FLIGHT_CONTROL_COPY.launchPrimer}</p>
            <p className="muted">You can free-fly immediately after launch.</p>
          </article>
          <article className="content-card entry-panel">
            <span className="entry-panel-kicker">Find a destination</span>
            <strong>Follow your curiosity</strong>
            <p>Open Explore to choose a planet, station or blackhole. Use cruise to reach a viewing point, then take over and look around.</p>
          </article>
          <article className="content-card entry-panel">
            <span className="entry-panel-kicker">Bring a friend</span>
            <strong>Fly together</strong>
            <p>Open Pilots to share an invite link or join the same room. Choose solo flight whenever you want your own space.</p>
          </article>
        </div>
      </div>
    </div>
  );
}
