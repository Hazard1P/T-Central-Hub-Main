'use client';

import { createPrivateWorldAsset } from '@/lib/privateWorldAsset';

export default function BlackholeMapPanel({ activeNode = null, lobbyMode = 'hub', steamUser = null }) {
  const activeLabel = activeNode?.label || 'Deep Space Blackhole';
  const routeState = activeNode?.route ? 'Route ready' : 'Anchor view';
  const privateWorldAsset = createPrivateWorldAsset({ steamUser, lobbyMode });

  return (
    <div className="blackhole-map-panel system-dock-card">
      <div className="live-room-head">
        <span className="pilot-assist-kicker">Map anchor</span>
        <strong>Blackhole gateway</strong>
      </div>

      <p className="lobby-mode-copy">
        The deep-space blackhole is the main gateway. The cosmic map keeps track of routes, home position, return lanes, and whether you are inside your private epoch system lattice or the shared hub star system.
      </p>

      <div className="map-anchor-visual" aria-hidden="true">
        <div className="map-anchor-core" />
        <div className="map-anchor-ring ring-a" />
        <div className="map-anchor-ring ring-b" />
        <div className="map-anchor-grid" />
      </div>

      <div className="steam-access-grid wallet-grid">
        <div className="steam-access-item">
          <span>Gateway</span>
          <strong>Deep Space Blackhole</strong>
        </div>
        <div className="steam-access-item">
          <span>Map</span>
          <strong>Route memory</strong>
        </div>
        <div className="steam-access-item">
          <span>Focus</span>
          <strong>{activeLabel}</strong>
        </div>
        <div className="steam-access-item">
          <span>Mode</span>
          <strong>{lobbyMode === 'hub' ? 'Shared hub' : 'Private universe'}</strong>
        </div>
        {privateWorldAsset ? (
          <>
            <div className="steam-access-item">
              <span>Private map</span>
              <strong>{privateWorldAsset.anchorToken}</strong>
            </div>
            <div className="steam-access-item">
              <span>Epoch</span>
              <strong>{privateWorldAsset.epochWindow}</strong>
            </div>
            <div className="steam-access-item">
              <span>Solar replicas</span>
              <strong>{privateWorldAsset.replicaSystems?.length || 0}</strong>
            </div>
            <div className="steam-access-item">
              <span>Server blackholes</span>
              <strong>{privateWorldAsset.serverBlackholeKeys?.length || 0}</strong>
            </div>
          </>
        ) : null}
      </div>

      <p className="lobby-mode-note">
        {routeState} · use the blackhole as the center point for travel, objectives, docking, and the external website handoff.
      </p>

      {privateWorldAsset ? (
        <p className="lobby-mode-note">
          Your private map stays sealed per account identity. The independent Central.Star replica systems roll from Unix epoch time, and four server-linked blackholes stay embedded as private anchors for multiplayer discrepancy control.
        </p>
      ) : null}
    </div>
  );
}
