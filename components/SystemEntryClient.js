'use client';

import { useState } from 'react';
import SteamLoginHud from '@/components/SteamLoginHud';
import SystemStatusStrip from '@/components/SystemStatusStrip';
import SystemLauncher from '@/components/SystemLauncher';
import LobbyModePanel from '@/components/LobbyModePanel';
import SystemErrorBoundary from '@/components/SystemErrorBoundary';
import StableSystemWorld from '@/components/StableSystemWorld';
import SystemNewsInfoPanel from '@/components/SystemNewsInfoPanel';
import SystemShellControlLayer from '@/components/SystemShellControlLayer';
import ExpandableDock from '@/components/ExpandableDock';
import { useSteamSession } from '@/components/SteamSessionProvider';

export default function SystemEntryClient() {
  const [entered, setEntered] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const { steamUser, universe, lobbyMode, setLobbyMode } = useSteamSession();

  return (
    <>
      <SteamLoginHud />
      <SystemStatusStrip />
      {entered ? <SystemNewsInfoPanel lobbyMode={lobbyMode} selected={selectedNode} /> : null}
      {entered ? (
        <SystemErrorBoundary>
          <>
            <div className="system-top-docks">
              <ExpandableDock
                title={lobbyMode === 'hub' ? 'Shared Hub mode' : 'Private Universe mode'}
                kicker="Mode"
                summary="Switch between isolated and shared play"
                defaultOpen={false}
                className="system-mode-dock"
              >
                <LobbyModePanel lobbyMode={lobbyMode} onChange={setLobbyMode} steamUser={steamUser} universe={universe} />
              </ExpandableDock>
            </div>
            <SystemShellControlLayer steamUser={steamUser} lobbyMode={lobbyMode} onChange={setLobbyMode} activeNode={selectedNode} />
            <StableSystemWorld lobbyMode={lobbyMode} steamUser={steamUser} onSelectionChange={setSelectedNode} />
          </>
        </SystemErrorBoundary>
      ) : <SystemLauncher onEnter={() => setEntered(true)} />}
    </>
  );
}
