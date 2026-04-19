'use client';

import { useMemo, useState } from 'react';

function getAnchorRoute(activeNode) {
  if (activeNode?.route) {
    return {
      href: activeNode.route,
      external: Boolean(activeNode.external),
      label: activeNode.label || 'Active route',
      note: activeNode.description || 'Anchored to the selected route inside the system fabric.',
    };
  }

  return {
    href: 'https://matrixcoinexchange.com',
    external: true,
    label: 'MatrixCoinExchange',
    note: 'External website linked into the cosmic map.',
  };
}

export default function WalletExchangePanel({ activeNode = null, lobbyMode = 'hub' }) {
  const anchorRoute = useMemo(() => getAnchorRoute(activeNode), [activeNode]);
  const [routeMode, setRouteMode] = useState(lobbyMode === 'hub' ? 'shared-shell' : 'private-shell');
  const [handoff, setHandoff] = useState('exchange');
  const [status, setStatus] = useState('Website route is ready inside the blackhole map.');

  const activeLabel = activeNode?.label || 'Deep Space Blackhole';
  const routeShellLabel = routeMode === 'shared-shell'
    ? 'Shared route'
    : routeMode === 'mission-cargo'
      ? 'Mission return'
      : 'Private route';

  const openHandoff = () => {
    if (typeof window === 'undefined') return;

    const destination = handoff === 'support'
      ? { href: '/donate', external: false, label: 'Support route' }
      : handoff === 'active-node'
        ? anchorRoute
        : { href: 'https://matrixcoinexchange.com', external: true, label: 'MatrixCoinExchange' };

    setStatus(`Route opened toward ${destination.label} from the blackhole gateway.`);

    if (destination.external) {
      window.open(destination.href, '_blank', 'noopener,noreferrer');
      return;
    }

    window.location.assign(destination.href);
  };

  return (
    <div className="wallet-exchange-panel system-dock-card">
      <div className="live-room-head">
        <span className="pilot-assist-kicker">Website route</span>
        <strong>External handoff</strong>
      </div>

      <p className="lobby-mode-copy">
        This panel keeps the website connected to the game as a destination only. It stays anchored to the blackhole gateway and also works as the return lane for settling E_s gains.
      </p>

      <div className="wallet-route-badges">
        <span className="wallet-route-badge is-live">Anchored</span>
        <span className="wallet-route-badge">{routeShellLabel}</span>
        <span className="wallet-route-badge">Website link</span>
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
          <span>Website</span>
          <strong>matrixcoinexchange.com</strong>
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

        <label>
          <span>Destination</span>
          <select
            value={handoff}
            onChange={(event) => setHandoff(event.target.value)}
          >
            <option value="exchange">Website</option>
            <option value="active-node">Current route</option>
            <option value="support">Support</option>
          </select>
        </label>
      </div>

      <div className="wallet-handoff-card">
        <div>
          <span>Current handoff</span>
          <strong>{handoff === 'active-node' ? anchorRoute.label : handoff === 'support' ? 'Support route' : 'MatrixCoinExchange'}</strong>
        </div>
        <small>
          {handoff === 'active-node'
            ? anchorRoute.note
            : handoff === 'support'
              ? 'Opens the support path while keeping the game route intact.'
              : 'Opens the linked website while keeping the blackhole as the in-game source.'}
        </small>
      </div>

      <div className="lobby-mode-actions wallet-actions wallet-route-actions">
        <button className="button primary" type="button" onClick={openHandoff}>
          Open route
        </button>
      </div>

      <p className="lobby-mode-note wallet-route-note">{status}</p>
    </div>
  );
}
