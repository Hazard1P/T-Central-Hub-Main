'use client';

import SteamAccessPanel from '@/components/SteamAccessPanel';
import SteamModeButtons from '@/components/SteamModeButtons';
import WalletExchangePanel from '@/components/WalletExchangePanel';
import BlackholeMapPanel from '@/components/BlackholeMapPanel';
import ExpandableDock from '@/components/ExpandableDock';
import SystemSupportDock from '@/components/SystemSupportDock';

export default function SystemShellControlLayer({ steamUser, lobbyMode, onChange, activeNode }) {
  return (
    <div className="system-shell-control-layer dock-stack">
      <ExpandableDock title="Pilot access" kicker="Controls" summary="Steam, identity, and session view" defaultOpen={false}>
        <SteamAccessPanel steamUser={steamUser} lobbyMode={lobbyMode} onChange={onChange} />
      </ExpandableDock>

      <ExpandableDock title="Universe switch" kicker="Travel" summary="Move between shared and private spaces" defaultOpen={false}>
        <SteamModeButtons steamUser={steamUser} lobbyMode={lobbyMode} onChange={onChange} />
      </ExpandableDock>

      <ExpandableDock title="Blackhole & map anchors" kicker="Navigation" summary="View the current anchor and route fabric" defaultOpen={false}>
        <BlackholeMapPanel activeNode={activeNode} lobbyMode={lobbyMode} steamUser={steamUser} />
      </ExpandableDock>

      <ExpandableDock title="Exchange settlement route" kicker="Economy" summary="Resolve cargo and reach MatrixCoinExchange" defaultOpen={false}>
        <WalletExchangePanel activeNode={activeNode} lobbyMode={lobbyMode} />
      </ExpandableDock>

      <ExpandableDock title="Support & membership" kicker="Community" summary="Donation and subscription access" defaultOpen={false}>
        <SystemSupportDock />
      </ExpandableDock>
    </div>
  );
}
