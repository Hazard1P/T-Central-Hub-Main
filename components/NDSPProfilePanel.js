'use client';

import { useMemo } from 'react';
import { createNDSPProfileContext } from '@/lib/ndspProfile';

export default function NDSPProfilePanel({ steamUser, lobbyMode = 'private' }) {
  const profile = useMemo(() => createNDSPProfileContext(steamUser, lobbyMode), [steamUser, lobbyMode]);

  return (
    <div className="ndsp-profile-panel">
      <div className="live-room-head">
        <span className="pilot-assist-kicker">NDSP profile scope</span>
        <strong>{profile.privateProfileLabel}</strong>
      </div>

      <p className="muted">{profile.description}</p>

      <div className="ndsp-profile-grid">
        <div className="ndsp-profile-item">
          <span>Steam ID</span>
          <strong>{profile.steamId}</strong>
        </div>
        <div className="ndsp-profile-item">
          <span>Instance scope</span>
          <strong>{profile.instanceScope}</strong>
        </div>
        <div className="ndsp-profile-item">
          <span>Namespace</span>
          <strong>{profile.namespace}</strong>
        </div>
        <div className="ndsp-profile-item">
          <span>Ledger key</span>
          <strong>{profile.profileLedgerKey}</strong>
        </div>
      </div>
    </div>
  );
}
