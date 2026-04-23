'use client';

import { useState } from 'react';
import SteamAccessPanel from '@/components/SteamAccessPanel';
import SteamModeButtons from '@/components/SteamModeButtons';
import WalletExchangePanel from '@/components/WalletExchangePanel';
import BlackholeMapPanel from '@/components/BlackholeMapPanel';

export default function SystemShellControlLayer({ steamUser, lobbyMode, onChange, activeNode }) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`system-shell-control-layer ${open ? 'open' : 'collapsed'}`}>
      <button
        className="system-shell-control-toggle"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? 'Collapse game controls' : 'Expand game controls'}
      >
        <span>Game controls</span>
        <strong>{open ? '−' : '+'}</strong>
      </button>

      {open ? (
        <div className="system-shell-control-stack">
          <SteamAccessPanel steamUser={steamUser} lobbyMode={lobbyMode} onChange={onChange} />
          <SteamModeButtons steamUser={steamUser} lobbyMode={lobbyMode} onChange={onChange} />
          <BlackholeMapPanel activeNode={activeNode} lobbyMode={lobbyMode} steamUser={steamUser} />
          <WalletExchangePanel activeNode={activeNode} lobbyMode={lobbyMode} />
        </div>
      ) : null}
    </div>
  );
}
