'use client';

import usePersistedPanelState from '@/components/usePersistedPanelState';
import SteamAccessPanel from '@/components/SteamAccessPanel';
import SteamModeButtons from '@/components/SteamModeButtons';
import WalletExchangePanel from '@/components/WalletExchangePanel';
import BlackholeMapPanel from '@/components/BlackholeMapPanel';
import DysonContinuityCheckpointPanel from '@/components/DysonContinuityCheckpointPanel';

export default function SystemShellControlLayer({ steamUser, lobbyMode, onChange, activeNode }) {
  const [open, toggleOpen] = usePersistedPanelState('tcentral-panel-system-shell', false);

  return (
    <div className={`system-shell-control-layer ${open ? 'open' : 'collapsed'}`}>
      <button
        className="system-shell-control-toggle"
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-label={open ? 'Collapse game controls' : 'Expand game controls'}
      >
        <span>Game controls</span>
        <span className="panel-toggle-summary">
          <strong>{lobbyMode === 'hub' ? 'Shared Hub' : 'Private Universe'}</strong>
          <small>{steamUser?.steamid ? 'Steam linked' : 'Guest'} · {activeNode?.label || 'No anchor selected'}</small>
        </span>
        <strong className="panel-minimize-indicator">{open ? '−' : '+'}</strong>
      </button>

      {open ? (
        <div className="system-shell-control-stack">
          <SteamAccessPanel steamUser={steamUser} lobbyMode={lobbyMode} onChange={onChange} />
          <SteamModeButtons steamUser={steamUser} lobbyMode={lobbyMode} onChange={onChange} />
          <BlackholeMapPanel activeNode={activeNode} lobbyMode={lobbyMode} steamUser={steamUser} />
          <DysonContinuityCheckpointPanel activeNode={activeNode} steamUser={steamUser} />
          <WalletExchangePanel activeNode={activeNode} lobbyMode={lobbyMode} />
        </div>
      ) : null}
    </div>
  );
}
