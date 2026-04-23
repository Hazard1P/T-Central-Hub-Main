'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildOperationsState } from '@/lib/missionFramework';
import { reducePresenceSnapshots, resolveMultiplayerIdentity } from '@/lib/multiplayerSyncEngine';
import { useMultiplayerSession } from '@/components/MultiplayerSessionProvider';

const ROOM_NAME = process.env.NEXT_PUBLIC_MULTIPLAYER_ROOM || 'tcentral-main';
const MAX_SLOTS = Number(process.env.NEXT_PUBLIC_MULTIPLAYER_MAX_SLOTS || 100);

function syncLocalPresence(handle) {
  if (typeof window === 'undefined') return () => {};
  const applySnapshot = (snapshot) => {
    if (!snapshot || snapshot.lobbyMode !== 'hub') return;
    handle(snapshot);
  };

  const onStorage = (event) => {
    if (event.key !== 'tcentral_presence_sync' || !event.newValue) return;
    try {
      applySnapshot(JSON.parse(event.newValue));
    } catch {}
  };

  const onEvent = (event) => applySnapshot(event.detail);
  window.addEventListener('storage', onStorage);
  window.addEventListener('tcentral-presence-updated', onEvent);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('tcentral-presence-updated', onEvent);
  };
}

export default function MultiplayerHud({ lobbyMode = 'hub', steamUser: externalSteamUser = null }) {
  const { session, authoritativeState, serverStatus } = useMultiplayerSession();
  const [steamUser, setSteamUser] = useState(externalSteamUser || null);
  const [presenceUsers, setPresenceUsers] = useState([]);
  const connected = Boolean(serverStatus?.connected);
  const joined = Boolean(session?.token);
  const serverMode = authoritativeState?.durable ? 'durable' : authoritativeState?.authoritative ? 'authoritative' : connected ? 'broadcast' : 'local';
  const authoritativeSummary = {
    tick: serverStatus?.tick || authoritativeState?.tick || 0,
    combatHeat: authoritativeState?.world?.combatHeat || 0,
    contestedNodes: authoritativeState?.world?.contestedNodes || [],
    durable: Boolean(authoritativeState?.durable),
  };

  const slotCount = presenceUsers.length;
  const slotsLeft = Math.max(0, MAX_SLOTS - slotCount);

  const summary = useMemo(() => ({
    room: ROOM_NAME,
    slotCount,
    slotsLeft,
    safetyInNumbers: slotCount >= 2,
  }), [slotCount, slotsLeft]);

  const operations = useMemo(() => buildOperationsState({
    lobbyMode,
    steamUser,
    presence: presenceUsers,
    progress: { visitedNodes: [], routeTrips: 0, seedCount: 0 },
  }), [lobbyMode, steamUser, presenceUsers]);

  useEffect(() => {
    setSteamUser(externalSteamUser || null);
  }, [externalSteamUser]);

  useEffect(() => {
    if (externalSteamUser?.steamid) return;
    let active = true;
    fetch('/api/auth/steam/session', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setSteamUser(data?.authenticated ? data.user : null);
      })
      .catch(() => {
        if (!active) return;
        setSteamUser(null);
      });
    return () => { active = false; };
  }, [externalSteamUser]);

  useEffect(() => {
    if (lobbyMode !== 'hub') {
      setPresenceUsers([]);
      return;
    }

    const stopLocalSync = syncLocalPresence((snapshot) => {
      setPresenceUsers((current) => reducePresenceSnapshots([snapshot, ...current], MAX_SLOTS));
    });

    const players = authoritativeState?.players || [];
    if (players.length) setPresenceUsers(players.slice(0, MAX_SLOTS));

    return () => {
      stopLocalSync();
    };
  }, [lobbyMode, authoritativeState?.players]);

  return (
    <div className="multiplayer-hud">
      <div className="multiplayer-card">
        <div className="multiplayer-topline">
          <span className="multiplayer-kicker">Hub status</span>
          <span className={`multiplayer-status ${connected ? 'online' : ''}`}>
            {connected ? 'Connected' : 'Offline'}
          </span>
        </div>

        <div className="multiplayer-grid">
          <div className="multiplayer-stat">
            <span>{lobbyMode === 'hub' ? 'Hub' : 'Universe'}</span>
            <strong>{lobbyMode === 'hub' ? summary.room : (steamUser?.steamid ? `private:${steamUser.steamid}` : 'private:guest')}</strong>
          </div>
          <div className="multiplayer-stat">
            <span>Players</span>
            <strong>{summary.slotCount} / {MAX_SLOTS}</strong>
          </div>
          <div className="multiplayer-stat">
            <span>Slots left</span>
            <strong>{summary.slotsLeft}</strong>
          </div>
          <div className="multiplayer-stat">
            <span>Activity</span>
            <strong>{summary.safetyInNumbers ? 'Active' : 'Waiting'}</strong>
          </div>
          <div className="multiplayer-stat">
            <span>Sync</span>
            <strong>{serverMode === 'durable' ? 'Durable shared state' : serverMode === 'authoritative' ? 'Live authority' : serverMode === 'broadcast' ? 'Local relay' : 'Offline'}</strong>
          </div>
          <div className="multiplayer-stat">
            <span>Shared star</span>
            <strong>{lobbyMode === 'hub' ? 'Discrepant hub system' : 'Private epoch system'}</strong>
          </div>
        </div>

        <div className="multiplayer-grid multiplayer-grid-ops">
          <div className="multiplayer-stat">
            <span>Combat</span>
            <strong>{authoritativeSummary.combatHeat}%</strong>
          </div>
          <div className="multiplayer-stat">
            <span>Server tick</span>
            <strong>{authoritativeSummary.tick}</strong>
          </div>
          <div className="multiplayer-stat">
            <span>Progress</span>
            <strong>{operations.completionPercent}%</strong>
          </div>
          <div className="multiplayer-stat">
            <span>Next step</span>
            <strong>{operations.nextDirective?.title || 'Stable'}</strong>
          </div>
        </div>

        <div className="multiplayer-presence">
          {lobbyMode === 'private' ? (
            <p className="multiplayer-note">You are in your private universe. Other players are fully disconnected, the shared hub is released before your private blackhole world is restored, and your 9-planet epoch system stays sealed to your own universe.</p>
          ) : joined ? (
            <p className="multiplayer-note">You are in the shared hub as <strong>{resolveMultiplayerIdentity(steamUser).displayName}</strong>. Players entering the hub join the same universe and can roam together. Hub state is <strong>{authoritativeSummary.durable ? 'durable-backed' : 'session-backed'}</strong>, and a discrepant shared star system stays active to keep hub synchronization aligned. {authoritativeSummary.contestedNodes.length ? `Contested nodes: ${authoritativeSummary.contestedNodes.map((node) => node.key).join(', ')}.` : 'No contested nodes right now.'}</p>
          ) : (
            <p className="multiplayer-note">The shared hub is available, but it is currently full or offline.</p>
          )}
        </div>
      </div>
    </div>
  );
}
