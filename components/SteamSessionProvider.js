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
  const [universe, setUniverse] = useState(null);
  const [presence, setPresence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lobbyMode, setLobbyModeState] = useState('hub');
  const channelRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const [steamRes, supportRes, universeRes] = await Promise.all([
        fetch('/api/auth/steam/session', { cache: 'no-store' }),
        fetch('/api/support/session', { cache: 'no-store' }),
        fetch(`/api/universe/session?lobbyMode=${encodeURIComponent(lobbyMode)}`, { cache: 'no-store' }),
      ]);

      const steamData = await steamRes.json().catch(() => null);
      const supportData = await supportRes.json().catch(() => null);
      const universeData = await universeRes.json().catch(() => null);

      setSteamUser(steamData?.authenticated ? steamData.user : null);
      setSupport(supportData?.linked ? supportData.support : null);

      if (universeData?.ok || universeData?.unavailable) {
        setUniverse(universeData);
      } else {
        setUniverse({
          ok: false,
          unavailable: true,
          code: 'UNIVERSE_SESSION_UNAVAILABLE',
          message: 'Universe session could not be resolved.',
          privacy: { observanceScope: 'hub:public', privacyTier: 'guest-public', storageKey: 'vault:guest' },
          prayerSeeds: { total: 0, latest: [] },
        });
      }
    } catch {
      setSteamUser(null);
      setSupport(null);
      setUniverse({
        ok: false,
        unavailable: true,
        code: 'UNIVERSE_SESSION_FETCH_FAILED',
        message: 'Universe session request failed.',
        privacy: { observanceScope: 'hub:public', privacyTier: 'guest-public', storageKey: 'vault:guest' },
        prayerSeeds: { total: 0, latest: [] },
      });
    } finally {
      setLoading(false);
    }
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
    const identity = resolveMultiplayerIdentity(steamUser);
    const snapshot = createPresenceSnapshot({
      steamUser,
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
  }, [steamUser, universe, lobbyMode]);

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
    support,
    universe,
    presence,
    loading,
    refresh,
    updatePresence,
    lobbyMode,
    setLobbyMode,
    authenticated: Boolean(steamUser?.steamid),
  }), [steamUser, support, universe, presence, loading, refresh, updatePresence, lobbyMode]);

  return <SteamSessionContext.Provider value={value}>{children}</SteamSessionContext.Provider>;
}

export function useSteamSession() {
  return useContext(SteamSessionContext);
}
