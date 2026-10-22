'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MINING_COOLDOWN } from '@/lib/shipEconomy';

export default function useShipEconomy({ session, roomName, shared }) {
  const key = shared && session?.room === roomName && session?.token ? session.id + ':' + session.token + ':' + roomName : '';
  const current = useRef(key); current.current = key;
  const settled = useRef(Promise.resolve());
  const busy = useRef(false), lastShot = useRef(0);
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [miningFeedback, setMiningFeedback] = useState(null);
  const send = useCallback(async function requestShip(action = 'state', fields = {}, quiet = false) {
    if (!key || current.current !== key) return;
    if (busy.current) {
      if (action === 'state' || quiet) return;
      // Preserve an explicit button action when a background refresh is running.
      setPending(true);
      await settled.current;
      return requestShip(action, fields, quiet);
    }
    let release;
    settled.current = new Promise(resolve => { release = resolve; });
    busy.current = key;
    if (action !== 'state') setPending(true);
    try {
      const response = await fetch('/api/game/economy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
        body: JSON.stringify({ ...fields, action, roomName, id: session.id, token: session.token, requestId: crypto.randomUUID() }),
      });
      const data = await response.json();
      if (current.current !== key) return;
      if (!response.ok || !data.ok) throw new Error(data.error || 'Shipyard request failed.');
      setSnapshot({ ...data, key }); setError('');
      if (data.receipt?.type === 'mine') {
        const message = '+' + data.receipt.ore + ' ore · ' + (data.receipt.hp ? data.receipt.hp + '/3 integrity' : 'asteroid depleted');
        setFeedback(message); setMiningFeedback({ message, at: Date.now() });
      }
      if (data.receipt?.type === 'deliver') setFeedback('Delivered ' + data.receipt.ore + ' ore · +' + data.receipt.credits + ' credits.');
      if (data.receipt?.type === 'upgrade') setFeedback('Upgrade installed · level ' + data.receipt.level + '.');
    } catch (failure) {
      if (current.current === key && !quiet) setError(failure.name === 'TimeoutError' ? 'Connection interrupted. Refresh your shipyard before retrying.' : failure.message);
    } finally {
      if (busy.current === key) { busy.current = false; setPending(false); }
      release();
    }
  }, [key, session, roomName]);
  useEffect(() => {
    setSnapshot(null); setError(''); setFeedback(''); setMiningFeedback(null); setPending(false); busy.current = false;
    if (!key) return;
    send();
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') send(); }, 1500);
    return () => window.clearInterval(interval);
  }, [key, send]);
  const data = snapshot?.key === key ? snapshot : null;
  const mineShot = useCallback((direction) => {
    if (!data?.location?.canMine || performance.now() - lastShot.current < MINING_COOLDOWN) return;
    lastShot.current = performance.now(); send('mine', { direction }, true);
  }, [data, send]);
  return { data, error, pending, feedback, miningFeedback, shared, ready: Boolean(key), send, mineShot };
}
