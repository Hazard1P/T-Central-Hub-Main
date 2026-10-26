'use client';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

import { useCallback, useEffect, useRef, useState } from 'react';
import { solarClockTime, solarDate, SOLAR_TIME_MIN, SOLAR_TIME_MAX } from '@/lib/solarSystem';

export default function useSolarClock() {
  const offset = useRef(0);
  const clock = useRef({ live: true, anchorUtcMs: Date.now(), anchorMonotonicMs: 0, rate: 1 });
  const [display, setDisplay] = useState({ utcMs: null, rate: 1, live: true, source: 'Syncing clock' });
  const getTime = useCallback(() => clock.current.live ? Date.now() + offset.current : solarClockTime(clock.current, performance.now()), []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function sync() {
      const start = Date.now();
      try {
        const response = await fetchWithTimeout('/api/astronomy/time', { cache: 'no-store', signal: controller.signal }, 8000);
        const data = await response.json();
        if (!response.ok || !Number.isFinite(data.unixMs)) throw new Error('clock');
        if (active) { offset.current = data.unixMs - (start + Date.now()) / 2; setDisplay((current) => ({ ...current, source: 'Server UTC' })); }
      } catch { if (active) setDisplay((current) => ({ ...current, source: 'Device UTC' })); }
    }
    const tick = () => {
      let utcMs = getTime();
      if (!clock.current.live && clock.current.rate !== 0 && (utcMs <= SOLAR_TIME_MIN || utcMs >= SOLAR_TIME_MAX)) {
        clock.current = { live: false, anchorUtcMs: utcMs, anchorMonotonicMs: performance.now(), rate: 0 };
      }
      setDisplay((current) => ({ ...current, utcMs, live: clock.current.live, rate: clock.current.rate }));
    };
    void sync(); tick();
    const ticker = setInterval(tick, 500), refresh = setInterval(sync, 300000);
    return () => { active = false; controller.abort(); clearInterval(ticker); clearInterval(refresh); };
  }, [getTime]);
  const setRate = useCallback((rate) => {
    if (![0, 1, 60, 3600, 86400, 2592000].includes(rate)) return;
    clock.current = { live: false, anchorUtcMs: getTime(), anchorMonotonicMs: performance.now(), rate };
    setDisplay((current) => ({ ...current, rate, live: false }));
  }, [getTime]);
  const setDate = useCallback((value) => {
    const utcMs = solarDate(value).getTime();
    clock.current = { live: false, anchorUtcMs: utcMs, anchorMonotonicMs: performance.now(), rate: 0 };
    setDisplay((current) => ({ ...current, utcMs, rate: 0, live: false }));
  }, []);
  const goLive = useCallback(() => {
    clock.current = { live: true, rate: 1 };
    setDisplay((current) => ({ ...current, utcMs: getTime(), live: true, rate: 1 }));
  }, [getTime]);
  return { ...display, getTime, setRate, setDate, goLive };
}
