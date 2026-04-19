'use client';

import { useState } from 'react';

export default function NewsInfoTab({ selected, lobbyMode = 'private', steamUser = null }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`news-info-tab ${open ? 'open' : ''}`}>
      <button
        className="news-info-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? 'Hide News & Info' : 'News & Info'}
      </button>

      <div className="news-info-panel">
        <div className="live-room-head">
          <span className="pilot-assist-kicker">Scene brief</span>
          <strong>{selected?.label || 'Universe status'}</strong>
        </div>

        <p className="muted">
          {selected?.description || 'The shell remains anchored across blackholes, Dyson spheres, the solar system, and connected route portals.'}
        </p>

        <div className="news-info-list">
          <div className="news-info-item">
            <span>World</span>
            <strong>{lobbyMode === 'hub' ? 'Multiplayer shell active' : 'Private shell active'}</strong>
          </div>
          <div className="news-info-item">
            <span>User</span>
            <strong>{steamUser?.personaname || 'Guest'}</strong>
          </div>
          <div className="news-info-item">
            <span>Focus</span>
            <strong>{selected?.kind || 'general'}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
