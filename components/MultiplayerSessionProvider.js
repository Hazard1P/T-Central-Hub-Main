'use client';

import { createContext, useContext, useMemo, useState } from 'react';

const defaultAuthoritativeState = {
  authoritative: false,
  players: [],
  projectiles: [],
  world: { contestedNodes: [], combatHeat: 0, anomalyPhase: 0 },
  playerCount: 0,
  mode: 'idle',
  modeTransition: { from: 'idle', to: 'idle', changedAt: 0, source: 'init' },
  ringAdjustments: { ringThreeSpinIntensity: 0, ringThreePulse: 0.12, intensity: 0 },
};

const defaultServerStatus = { connected: false, label: 'Offline', tick: 0 };

const MultiplayerSessionContext = createContext({
  session: null,
  authoritativeState: defaultAuthoritativeState,
  serverStatus: defaultServerStatus,
  setSession: () => {},
  setAuthoritativeState: () => {},
  setServerStatus: () => {},
  resetSessionState: () => {},
});

export function MultiplayerSessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authoritativeState, setAuthoritativeState] = useState(defaultAuthoritativeState);
  const [serverStatus, setServerStatus] = useState(defaultServerStatus);

  const resetSessionState = () => {
    setSession(null);
    setAuthoritativeState(defaultAuthoritativeState);
    setServerStatus(defaultServerStatus);
  };

  const value = useMemo(() => ({
    session,
    authoritativeState,
    serverStatus,
    setSession,
    setAuthoritativeState,
    setServerStatus,
    resetSessionState,
  }), [session, authoritativeState, serverStatus]);

  return (
    <MultiplayerSessionContext.Provider value={value}>
      {children}
    </MultiplayerSessionContext.Provider>
  );
}

export function useMultiplayerSession() {
  return useContext(MultiplayerSessionContext);
}
