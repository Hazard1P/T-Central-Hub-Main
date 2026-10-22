'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPresenceSnapshot, reducePresenceSnapshots, resolveMultiplayerIdentity } from '@/lib/multiplayerSyncEngine';


function clearPresenceIsolation() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem('tcentral_presence_sync'); } catch {}
  try { window.localStorage.removeItem('tcentral_presence_identity'); } catch {}
  window.dispatchEvent(new CustomEvent('tcentral-presence-cleared'));
}

const SteamSessionContext = createContext({
  steamUser: null,
  googleUser: null,
  support: null,
  universe: null,
  loading: true,
  refresh: async () => {},
  authenticated: false,
  lobbyMode: 'hub',
  setLobbyMode: () => {},
  updatePresence: () => {},
  presence: [],
});

export function SteamSessionProvider({ children }) {
  const [steamUser, setSteamUser] = useState(null);
  const [support, setSupport] = useState(null);
  const [googleUser, setGoogleUser] = useState(null);
  const [universe, setUniverse] = useState(null);
  const [presence, setPresence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lobbyMode, setLobbyModeState] = useState('hub');
  const channelRef = useRef(null);

  const refreshGeneration = useRef(0);
  const [sessionError, setSessionError] = useState('');
  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    const read = async (url) => {
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Session request failed');
      return response.json();
    };
    const results = await Promise.allSettled([
      read('/api/auth/steam/session'), read('/api/auth/google/session'),
      read('/api/support/session'), read(`/api/universe/session?lobbyMode=${encodeURIComponent(lobbyMode)}`),
    ]);
    if (generation !== refreshGeneration.current) return;
    const [steam, google, supportResult, universeResult] = results;
    // A failed auxiliary request must never sign a verified player out.
    if (steam.status === 'fulfilled') setSteamUser(steam.value?.authenticated ? steam.value.user : null);
    if (google.status === 'fulfilled') setGoogleUser(google.value?.authenticated ? google.value.user : null);
    setSupport(supportResult.status === 'fulfilled' && supportResult.value?.linked ? supportResult.value.support : null);
    setUniverse(universeResult.status === 'fulfilled' ? universeResult.value : { unavailable: true, message: 'Account collection is temporarily unavailable.' });
    setSessionError(steam.status === 'rejected' || google.status === 'rejected' ? 'Could not refresh your account. Your last verified session is retained; retry before joining a flight.' : '');
    setLoading(false);
  }, [lobbyMode]);

  const setLobbyMode = useCallback((nextMode) => {
    setLobbyModeState((current) => {
      if (!nextMode || nextMode === current) return current;
      if (nextMode !== 'hub') {
        setPresence([]);
        clearPresenceIsolation();
      }
      return nextMode;
    });
  }, []);

  const updatePresence = useCallback((telemetry) => {
    const identity = resolveMultiplayerIdentity(steamUser, googleUser);
    const snapshot = createPresenceSnapshot({
      steamUser,
      googleUser,
      telemetry,
      scope: universe?.privacy,
      lobbyMode,
    });

    setPresence((current) => reducePresenceSnapshots([snapshot, ...current]));

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('tcentral_presence_identity', JSON.stringify(identity));
      } catch {}
      try {
        window.localStorage.setItem('tcentral_presence_sync', JSON.stringify(snapshot));
      } catch {}
      window.dispatchEvent(new CustomEvent('tcentral-presence-updated', { detail: snapshot }));
    }

    if (channelRef.current) {
      try {
        channelRef.current.postMessage(snapshot);
      } catch {}
    }
  }, [steamUser, googleUser, universe, lobbyMode]);

  useEffect(() => {
    refresh();
    const intervalId = window.setInterval(refresh, 30000);
    const handleFocus = () => refresh();
    const handleStorage = (event) => {
      if (!event.key || ['steam_session_sync', 'tcentral_presence_sync'].includes(event.key)) refresh();
      if (event.key === 'tcentral_presence_sync' && event.newValue) {
        try {
          const snapshot = JSON.parse(event.newValue);
          setPresence((current) => reducePresenceSnapshots([snapshot, ...current]));
        } catch {}
      }
    };
    const handleSessionBroadcast = () => refresh();
    const handlePresence = (event) => {
      const snapshot = event.detail;
      if (snapshot && lobbyMode === 'hub') setPresence((current) => reducePresenceSnapshots([snapshot, ...current]));
    };
    const handlePresenceCleared = () => setPresence([]);

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channelRef.current = new BroadcastChannel('tcentral-universe-observance');
      channelRef.current.onmessage = (event) => {
        if (event?.data) setPresence((current) => reducePresenceSnapshots([event.data, ...current]));
      };
    }

    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('steam-session-updated', handleSessionBroadcast);
    window.addEventListener('tcentral-presence-updated', handlePresence);
    window.addEventListener('tcentral-presence-cleared', handlePresenceCleared);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('steam-session-updated', handleSessionBroadcast);
      window.removeEventListener('tcentral-presence-updated', handlePresence);
      window.removeEventListener('tcentral-presence-cleared', handlePresenceCleared);
      if (channelRef.current) channelRef.current.close();
    };
  }, [refresh, lobbyMode]);

  const value = useMemo(() => ({
    steamUser,
    googleUser,
    support,
    universe,
    presence,
    loading,
    refresh,
    updatePresence,
    lobbyMode,
    setLobbyMode,
    sessionError,
    authenticated: Boolean(steamUser?.steamid || googleUser?.sub),
  }), [steamUser, googleUser, support, universe, presence, loading, refresh, updatePresence, lobbyMode, sessionError]);

  return <SteamSessionContext.Provider value={value}>{children}</SteamSessionContext.Provider>;
}

export function useSteamSession() {
  return useContext(SteamSessionContext);
}
