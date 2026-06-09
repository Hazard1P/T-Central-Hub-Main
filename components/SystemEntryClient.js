'use client';

import { useEffect, useRef, useState } from 'react';
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
import { gameEngine } from '@/lib/gameEngine';

export default function SystemEntryClient() {
  const [launchPhase, setLaunchPhase] = useState('idle');
  const [selectedNode, setSelectedNode] = useState(null);
  const previousLaunchPhaseRef = useRef(launchPhase);
  const { steamUser, universe, lobbyMode, setLobbyMode } = useSteamSession();

  useEffect(() => {
    if (launchPhase !== 'launching') return undefined;

    let cancelled = false;

    try {
      const transitionTimer = window.setTimeout(() => {
        if (!cancelled) setLaunchPhase('in_sim');
      }, 120);

      return () => {
        cancelled = true;
        window.clearTimeout(transitionTimer);
      };
    } catch (error) {
      console.error('System launch transition failed before 3D mount.', error);
      setLaunchPhase('error');
    }

    return undefined;
  }, [launchPhase]);

  useEffect(() => {
    const previousLaunchPhase = previousLaunchPhaseRef.current;
    previousLaunchPhaseRef.current = launchPhase;

    if (previousLaunchPhase === 'in_sim' || launchPhase !== 'in_sim' || typeof window === 'undefined') return;

    try {
      gameEngine.init();
    } catch (error) {
      console.error('Game engine initialization failed during simulation handoff.', error);
      setLaunchPhase('error');
    }
  }, [launchPhase]);

  const handleEnter = () => {
    setLaunchPhase('launching');
  };

  const resetLauncher = () => {
    setSelectedNode(null);
    setLaunchPhase('idle');
  };

  return (
    <>
      <SteamLoginHud />
      <SystemStatusStrip />
      {launchPhase === 'in_sim' ? <SystemNewsInfoPanel lobbyMode={lobbyMode} selected={selectedNode} /> : null}
      {launchPhase === 'in_sim' ? (
        <SystemErrorBoundary onReset={resetLauncher}>
          <MultiplayerSessionProvider>
            <div className="system-top-left-controls">
              <LobbyModePanel lobbyMode={lobbyMode} onChange={setLobbyMode} steamUser={steamUser} universe={universe} />
              <SystemShellControlLayer steamUser={steamUser} lobbyMode={lobbyMode} onChange={setLobbyMode} activeNode={selectedNode} />
            </div>
            <StableSystemWorld lobbyMode={lobbyMode} steamUser={steamUser} onSelectionChange={setSelectedNode} />
          </MultiplayerSessionProvider>
        </SystemErrorBoundary>
      ) : (
        <>
          <SystemLauncher onEnter={handleEnter} />
          {launchPhase === 'error' ? (
            <div className="content-card observer" role="alert">
              <p className="eyebrow">Initialization issue</p>
              <h3>3D layer failed before simulation handoff.</h3>
              <p className="muted">Please try launching again. If this persists, refresh the page.</p>
              <button className="button primary" onClick={resetLauncher}>
                Reset launcher
              </button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
