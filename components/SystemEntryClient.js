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
import { MultiplayerSessionProvider } from '@/components/MultiplayerSessionProvider';
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
          <MultiplayerSessionProvider>
            <LobbyModePanel lobbyMode={lobbyMode} onChange={setLobbyMode} steamUser={steamUser} universe={universe} />
            <SystemShellControlLayer steamUser={steamUser} lobbyMode={lobbyMode} onChange={setLobbyMode} activeNode={selectedNode} />
            <StableSystemWorld lobbyMode={lobbyMode} steamUser={steamUser} onSelectionChange={setSelectedNode} />
          </MultiplayerSessionProvider>
        </SystemErrorBoundary>
      ) : <SystemLauncher onEnter={() => setEntered(true)} />}
    </>
  );
}
