'use client';

import { useEffect } from 'react';
import { useMultiplayerSession } from '@/components/MultiplayerSessionProvider';

const emptyState = { players: [], projectiles: [], playerCount: 0, authoritative: false };

async function release(session) {
  if (!session?.token) return;
  try {
    await fetch('/api/multiplayer/disconnect', {
      method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ roomName: session.room, id: session.id, token: session.token }),
    });
  } catch {}
}

export default function useSharedFlight({ lobbyMode, roomName, identity, telemetryRef, inputsRef, simRuntimeClient, gravitySources, onCorrection }) {
  const { setSession, setAuthoritativeState, setServerStatus } = useMultiplayerSession();

  useEffect(() => {
    let stopped = false;
    let session = null;
    let timer;
    let failures = 0;
    const controller = new AbortController();
    setSession(null);
    setAuthoritativeState(emptyState);
    inputsRef.current = [];
    if (lobbyMode !== 'hub') {
      setServerStatus({ connected: false, label: 'Solo flight', tick: 0 });
      return;
    }
    setServerStatus({ connected: false, label: 'Connecting', tick: 0 });

    // AbortController works on mobile browsers that predate AbortSignal.any/timeout.
    async function post(endpoint, body) {
      const request = new AbortController();
      const abort = () => request.abort();
      controller.signal.addEventListener('abort', abort, { once: true });
      const timeout = window.setTimeout(abort, 8000);
      try {
        const response = await fetch('/api/multiplayer/' + endpoint, {
          method: 'POST', headers: { 'content-type': 'application/json' }, signal: request.signal,
          body: JSON.stringify(body),
        });
        const data = await response.json();
        return { response, data };
      } finally {
        window.clearTimeout(timeout);
        controller.signal.removeEventListener('abort', abort);
      }
    }

    async function tick() {
      try {
        if (!session) {
          const { response, data } = await post('connect', { identity, roomName, mode: 'multi_player' });
          if (!response.ok || !data.ok || !data.token || !data.player?.id) throw new Error('join-failed');
          session = { room: data.room, id: data.player.id, token: data.token, displayName: data.player.displayName };
          if (stopped) { void release(session); return; }
          setSession(session);
          // Rejoin at the server's position rather than publishing a private-world transform.
          inputsRef.current = [];
          onCorrection({ position: data.player.position, velocity: data.player.velocity, snap: true });
        }

        const snapshot = {
          ...telemetryRef.current,
          inputs: inputsRef.current.slice(0, 48).map(({ frameIndex, dt, controlVector }) => ({ frameIndex, dt, controlVector })),
        };
        const { response, data } = await post('state', { roomName: session.room, id: session.id, token: session.token, mode: 'multi_player', snapshot });
        if (stopped) return;
        if (response.status === 401) {
          session = null;
          setSession(null);
          setAuthoritativeState(emptyState);
          throw new Error('session-expired');
        }
        if (!response.ok || !data.ok || !data.state) throw new Error('sync-failed');
        failures = 0;
        setAuthoritativeState(data.state);
        setServerStatus({ connected: true, label: 'Live', durable: Boolean(data.state.durable), tick: data.tick || 0 });
        const self = data.state.players?.find((pilot) => pilot.id === session.id);
        if (self?.position && self?.velocity) {
          inputsRef.current = inputsRef.current.filter((frame) => frame.frameIndex > self.frameIndex).slice(-120);
          const prediction = simRuntimeClient.replayAuthoritativeState({ frames: inputsRef.current, authoritativePosition: self.position, authoritativeVelocity: self.velocity, simulationSeed: roomName, gravitySources });
          const error = Math.hypot(...prediction.position.map((value, index) => value - (telemetryRef.current.position?.[index] || 0)));
          if (error > .3) onCorrection(prediction);
        }
      } catch {
        if (stopped) return;
        failures += 1;
        setServerStatus({ connected: false, label: 'Reconnecting', tick: 0 });
      }
      // One in-flight request, independent of render rate. Slow connections back off.
      if (!stopped) timer = window.setTimeout(tick, failures ? Math.min(10000, 1000 * 2 ** Math.min(failures - 1, 4)) : 250);
    }
    void tick();
    const unload = () => { void release(session); };
    window.addEventListener('pagehide', unload);
    return () => {
      stopped = true;
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener('pagehide', unload);
      void release(session);
    };
  }, [lobbyMode, roomName, identity, telemetryRef, inputsRef, simRuntimeClient, gravitySources, onCorrection, setSession, setAuthoritativeState, setServerStatus]);
}
