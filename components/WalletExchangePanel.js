'use client';

import { useMemo, useState } from 'react';

function isBlockedRoute(route = '') {
  const blockedHost = ['matrix', 'coin', 'exchange'].join('');
  return route.toLowerCase().includes(blockedHost);
}

function isValidRoute(route = '') {
  if (!route || isBlockedRoute(route)) return false;
  return route.startsWith('/') || /^https?:\/\//i.test(route);
}

function getAnchorRoute(activeNode) {
  if (isValidRoute(activeNode?.route)) {
    return {
      href: activeNode.route,
      external: Boolean(activeNode.external),
      label: activeNode.label || 'Active route',
      note: activeNode.description || 'Anchored to the selected route inside the system fabric.',
      valid: true,
    };
  }

  return {
    href: '',
    external: false,
    label: activeNode?.label || 'No active website route',
    note: activeNode?.route
      ? 'The selected node does not expose an allowed website route.'
      : 'Select a node with a website route to open it from the blackhole map.',
    valid: false,
  };
}

export default function WalletExchangePanel({ activeNode = null, lobbyMode = 'hub' }) {
  const anchorRoute = useMemo(() => getAnchorRoute(activeNode), [activeNode]);
  const [routeMode, setRouteMode] = useState(lobbyMode === 'hub' ? 'shared-shell' : 'private-shell');
  const [status, setStatus] = useState('Website route is ready inside the blackhole map.');

  const activeLabel = activeNode?.label || 'Deep Space Blackhole';

  const routeShellLabel = routeMode === 'shared-shell'
    ? 'Shared route'
    : routeMode === 'mission-cargo'
      ? 'Mission return'
      : 'Private route';

  const openRoute = () => {
    if (typeof window === 'undefined') return;

    if (!anchorRoute.valid) {
      setStatus('No allowed website route is selected. Choose a valid non-blocked node first.');
      return;
    }

    setStatus(`Route opened toward ${anchorRoute.label} from the blackhole gateway.`);

    if (anchorRoute.external) {
      window.open(anchorRoute.href, '_blank', 'noopener,noreferrer');
      return;
    }

    window.location.assign(anchorRoute.href);
  };

  return (
    <div className="wallet-exchange-panel system-dock-card">
      <div className="live-room-head">
        <span className="pilot-assist-kicker">Website route</span>
        <strong>Blackhole route</strong>
      </div>

      <p className="lobby-mode-copy">
        This panel keeps the simulation connected to the selected website route only. It stays anchored to the blackhole gateway and opens a route only when the active node provides an allowed non-blocked destination.
      </p>

      <div className="wallet-route-badges">
        <span className="wallet-route-badge is-live">Anchored</span>
        <span className="wallet-route-badge">{routeShellLabel}</span>
        <span className="wallet-route-badge">Website route</span>
        <span className="wallet-route-badge">{anchorRoute.valid ? 'Route available' : 'No route selected'}</span>
      </div>

      <div className="steam-access-grid wallet-grid">
        <div className="steam-access-item">
          <span>Gateway</span>
          <strong>Deep Space Blackhole</strong>
        </div>
        <div className="steam-access-item">
          <span>Map route</span>
          <strong>Cosmic fabric</strong>
        </div>
        <div className="steam-access-item">
          <span>Focus</span>
          <strong>{activeLabel}</strong>
        </div>
        <div className="steam-access-item">
          <span>Selected route</span>
          <strong>{anchorRoute.valid ? anchorRoute.label : 'Unavailable'}</strong>
        </div>
        <div className="steam-access-item">
          <span>Route type</span>
          <strong>{anchorRoute.valid ? (anchorRoute.external ? 'External website' : 'Internal path') : 'Blocked'}</strong>
        </div>
        <div className="steam-access-item">
          <span>Route guard</span>
          <strong>{anchorRoute.valid ? 'Allowed' : 'Waiting for node'}</strong>
        </div>
      </div>

      <div className="wallet-route-controls">
        <label>
          <span>Route mode</span>
          <select
            value={routeMode}
            onChange={(event) => setRouteMode(event.target.value)}
          >
            <option value="shared-shell">Shared route</option>
            <option value="private-shell">Private route</option>
            <option value="mission-cargo">Mission return</option>
          </select>
        </label>
      </div>

      <div className="wallet-handoff-card">
        <div>
          <span>Current website route</span>
          <strong>{anchorRoute.label}</strong>
        </div>
        <small>{anchorRoute.note}</small>
      </div>

      <div className="lobby-mode-actions wallet-actions wallet-route-actions">
        <button className="button primary" type="button" onClick={openRoute} disabled={!anchorRoute.valid}>
          Open selected route
        </button>
      </div>

      <p className="lobby-mode-note wallet-route-note">{status}</p>
      <p className="lobby-mode-note wallet-route-note">
        Website routing remains local to the selected node. No default external destination is opened when the node is missing or blocked.
      </p>
    </div>
  );
}
