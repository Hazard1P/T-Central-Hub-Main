'use client';

import { useMemo, useState } from 'react';
import { WORLD_LAYOUT } from '@/lib/worldLayout';

export default function SceneObjectsSidebar({ lobbyMode = 'hub' }) {
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    return {
      blackholes: WORLD_LAYOUT.filter((n) => n.kind === 'blackhole'),
      dyson: WORLD_LAYOUT.filter((n) => n.kind === 'dyson'),
      solar: WORLD_LAYOUT.filter((n) => n.kind === 'solar'),
    };
  }, []);

  return (
    <div className={`scene-objects-sidebar ${open ? 'open' : ''}`}>
      <button
        className="scene-objects-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? 'Hide Scene Objects' : 'Scene Objects'}
      </button>

      <div className="scene-objects-panel">
        <div className="live-room-head">
          <span className="pilot-assist-kicker">Quick scene view</span>
          <strong>{lobbyMode === 'hub' ? 'Multiplayer hub' : 'Private world'}</strong>
        </div>

        <div className="scene-objects-group">
          <span className="scene-objects-title">Blackholes</span>
          <div className="scene-objects-chiplist">
            {grouped.blackholes.map((node) => (
              <span key={node.key} className={`scene-objects-chip ${node.key === 'matrixcoinexchange' ? 'matrix' : ''}`}>
                {node.label}
              </span>
            ))}
          </div>
        </div>

        <div className="scene-objects-group">
          <span className="scene-objects-title">Dyson spheres</span>
          <div className="scene-objects-chiplist">
            {grouped.dyson.map((node) => (
              <span key={node.key} className="scene-objects-chip">
                {node.label}
              </span>
            ))}
          </div>
        </div>

        <div className="scene-objects-group">
          <span className="scene-objects-title">Solar system</span>
          <div className="scene-objects-chiplist">
            {grouped.solar.map((node) => (
              <span key={node.key} className="scene-objects-chip">
                {node.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
