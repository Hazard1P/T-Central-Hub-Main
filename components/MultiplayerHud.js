'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildOperationsState } from '@/lib/missionFramework';
import { reducePresenceSnapshots, resolveMultiplayerIdentity } from '@/lib/multiplayerSyncEngine';
import { subscribeToMultiplayerRoom } from '@/lib/multiplayerRealtimeClient';

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
  const [steamUser, setSteamUser] = useState(externalSteamUser || null);
  const [presenceUsers, setPresenceUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [serverMode, setServerMode] = useState('local');
  const [authoritativeSummary, setAuthoritativeSummary] = useState({ tick: 0, combatHeat: 0, contestedNodes: [], durable: false });

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
      setConnected(false);
      setJoined(false);
      setPresenceUsers([]);
      setServerMode('private');
      setAuthoritativeSummary({ tick: 0, combatHeat: 0, contestedNodes: [], durable: false });
      return;
    }

    const identity = resolveMultiplayerIdentity(steamUser);
    const stopLocalSync = syncLocalPresence((snapshot) => {
      setPresenceUsers((current) => reducePresenceSnapshots([snapshot, ...current], MAX_SLOTS));
    });

    let cancelled = false;
    let authorityInterval = null;
    let stopRealtime = () => {};

    const connect = async () => {
      try {
        const response = await fetch('/api/multiplayer/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity, steamUser, roomName: ROOM_NAME }),
        });
        const data = await response.json().catch(() => null);
        if (cancelled || !response.ok || !data?.ok) throw new Error('authority-unavailable');

        const session = { id: data.player?.id, token: data.token, room: data.room };
        setConnected(true);
        setJoined(true);
        setServerMode(data?.server?.durable ? 'durable' : 'authoritative');

        const tick = async () => {
          const stateResponse = await fetch('/api/multiplayer/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomName: session.room,
              id: session.id,
              token: session.token,
              snapshot: {
                position: [0, 0, 0],
                velocity: [0, 0, 0],
                direction: [0, 0, -1],
                nearest: 'hub_relay',
                speed: 0,
                quantumSignature: 'HUD',
              },
            }),
          }).catch(() => null);
          const state = await stateResponse?.json?.().catch?.(() => null);
          if (cancelled || !state?.state) return;
          setPresenceUsers(state.state.players || []);
          setAuthoritativeSummary({
            tick: state.tick || 0,
            combatHeat: state.state.world?.combatHeat || 0,
            contestedNodes: state.state.world?.contestedNodes || [],
            durable: Boolean(state.state.durable || data?.server?.durable),
          });
        };

        await tick();
        stopRealtime = subscribeToMultiplayerRoom({ roomName: session.room, onSignal: () => { void tick(); } });
        authorityInterval = window.setInterval(tick, data?.server?.durable ? 1600 : 900);
      } catch {
        if (cancelled) return;
        setConnected(true);
        setJoined(true);
        setServerMode('broadcast');
        setPresenceUsers((current) => reducePresenceSnapshots([{
          id: identity.id,
          displayName: identity.displayName,
          avatar: steamUser?.avatar || null,
          identityKind: identity.kind,
          updatedAt: new Date().toISOString(),
        }, ...current], MAX_SLOTS));
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (authorityInterval) window.clearInterval(authorityInterval);
      stopRealtime();
      stopLocalSync();
      setConnected(false);
      setJoined(false);
    };
  }, [steamUser, lobbyMode, externalSteamUser]);

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
