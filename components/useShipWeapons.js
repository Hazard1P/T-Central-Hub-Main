'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createShipPulse, PULSE_INTERVAL_MS } from '@/lib/shipWeapons';

export default function useShipWeapons({ session, roomName, shared, onMineShot, onFireSound }) {
  const bus = useRef({ shots: [], impacts: [], lastFired: 0 });
  const inFlight = useRef(false), sequence = useRef(0), generation = useRef(0);
  const [status, setStatus] = useState('');
  useEffect(() => {
    generation.current += 1; bus.current.shots = []; bus.current.impacts = []; bus.current.lastFired = 0; inFlight.current = false; setStatus('');
  }, [roomName, shared]);
  const fire = useCallback((action) => {
    const now = performance.now();
    if (now - bus.current.lastFired < PULSE_INTERVAL_MS) return;
    const shot = createShipPulse({ ...action, now, id: 'local-' + (++sequence.current), ownerId: session?.id });
    if (!shot) return;
    bus.current.lastFired = now;
    onFireSound?.();
    onMineShot?.(shot.direction);
    bus.current.shots = [...bus.current.shots.filter((entry) => entry.expiresAt > now).slice(-47), shot];
    if(session?.transport==='websocket'){session.fire?.(shot.direction);return;}
    if (!shared || !session?.token || session.room !== roomName || inFlight.current) return;
    inFlight.current = true;
    const requestGeneration = generation.current;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    fetch('/api/multiplayer/action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ roomName, id: session.id, token: session.token, mode: 'multi_player', captureSimulationEvent: false, action: { type: 'fire', direction: shot.direction } }),
    }).then((response) => {
      if (requestGeneration !== generation.current) return;
      setStatus(response.ok || response.status === 429 ? '' : 'Local cannons ready · shared weapons reconnecting');
    }).catch(() => { if (requestGeneration === generation.current) setStatus('Local cannons ready · shared weapons reconnecting'); })
      .finally(() => { window.clearTimeout(timeout); if (requestGeneration === generation.current) inFlight.current = false; });
  }, [roomName, session, shared, onMineShot, onFireSound]);
  return { bus, fire, status };
}
