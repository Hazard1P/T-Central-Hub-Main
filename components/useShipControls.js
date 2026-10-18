'use client';

import { useEffect, useRef } from 'react';
import { FLIGHT_KEYS, isInteractiveTarget, shouldIgnoreFlightKey } from '@/lib/flightInput';

export default function useShipControls({ gl, yaw, pitch, keys, blocked, onManualControl, onSimulationFrame }) {
  const firing = useRef(false);
  useEffect(() => {
    const canvas = gl.domElement;
    let touch = null, lastMouse = null;
    const clear = () => { keys.current = {}; firing.current = false; touch = null; lastMouse = null; onSimulationFrame?.({ controlVector: [0, 0, 0] }); };
    const steer = (dx, dy) => {
      if (blocked || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
      if (Math.abs(dx) + Math.abs(dy) < .05) return;
      onManualControl?.();
      yaw.current -= Math.max(-100, Math.min(100, dx)) * .0022;
      pitch.current = Math.max(-Math.PI / 2.35, Math.min(Math.PI / 2.35, pitch.current + Math.max(-100, Math.min(100, dy)) * .0018));
    };
    const down = (event) => {
      if (event.code === 'Escape') {
        clear();
        if (document.pointerLockElement === canvas) document.exitPointerLock?.();
        return;
      }
      if (blocked || shouldIgnoreFlightKey(event) || !FLIGHT_KEYS.has(event.code)) return;
      keys.current[event.code] = true; onManualControl?.(); event.preventDefault();
    };
    const up = (event) => { keys.current[event.code] = false; };
    const start = (event) => {
      if (blocked || event.button !== 0) return;
      if (event.pointerType === 'touch' || event.pointerType === 'pen') { touch = { id: event.pointerId, x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); }
      else {
        firing.current = true;
        try { const request = canvas.requestPointerLock?.(); request?.catch?.(() => {}); } catch {}
      }
      onManualControl?.();
    };
    const move = (event) => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        if (touch?.id !== event.pointerId) return;
        steer(event.clientX - touch.x, event.clientY - touch.y); touch.x = event.clientX; touch.y = event.clientY;
      } else if (document.pointerLockElement !== canvas) {
        if (lastMouse) steer(event.clientX - lastMouse.x, event.clientY - lastMouse.y);
        lastMouse = { x: event.clientX, y: event.clientY };
      }
    };
    const lockedMove = (event) => { if (document.pointerLockElement === canvas) steer(event.movementX, event.movementY); };
    const end = (event) => { firing.current = false; if (touch?.id === event.pointerId) touch = null; };
    const leave = () => { lastMouse = null; if (document.pointerLockElement !== canvas) firing.current = false; };
    const lock = () => { lastMouse = null; if (document.pointerLockElement !== canvas) clear(); };
    const focus = (event) => { if (isInteractiveTarget(event.target)) clear(); };
    const visibility = () => { if (document.hidden) clear(); };
    if (blocked && document.pointerLockElement === canvas) document.exitPointerLock?.();
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear); window.addEventListener('pointerup', end);
    document.addEventListener('mousemove', lockedMove); document.addEventListener('pointerlockchange', lock); document.addEventListener('focusin', focus); document.addEventListener('visibilitychange', visibility);
    canvas.addEventListener('pointerdown', start); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointercancel', end); canvas.addEventListener('lostpointercapture', end); canvas.addEventListener('pointerleave', leave);
    return () => {
      clear(); if (document.pointerLockElement === canvas) document.exitPointerLock?.();
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); window.removeEventListener('pointerup', end);
      document.removeEventListener('mousemove', lockedMove); document.removeEventListener('pointerlockchange', lock); document.removeEventListener('focusin', focus); document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointerdown', start); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointercancel', end); canvas.removeEventListener('lostpointercapture', end); canvas.removeEventListener('pointerleave', leave);
    };
  }, [gl, blocked, yaw, pitch, keys, onManualControl, onSimulationFrame]);
  return firing;
}
