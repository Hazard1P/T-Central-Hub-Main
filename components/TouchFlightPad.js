'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveHeldFlightAxes } from '@/lib/flightInput';

function FlightButton({ axis, value, label, children, hold, release, active, className = '' }) {
  const keyboardId = `keyboard-${axis}-${value}`;
  return (
    <button
      type="button"
      className={`${className}${active ? ' is-held' : ''}`.trim()}
      aria-label={label}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        hold(event.pointerId, axis, value);
      }}
      onPointerUp={(event) => release(event.pointerId)}
      onPointerCancel={(event) => release(event.pointerId)}
      onLostPointerCapture={(event) => release(event.pointerId)}
      onKeyDown={(event) => {
        if (![' ', 'Enter'].includes(event.key)) return;
        event.preventDefault();
        hold(keyboardId, axis, value);
      }}
      onKeyUp={(event) => {
        if (![' ', 'Enter'].includes(event.key)) return;
        event.preventDefault();
        release(keyboardId);
      }}
      onBlur={() => release(keyboardId)}
    >{children}</button>
  );
}

export default function TouchFlightPad({ onInputChange, walking=false }) {
  const held = useRef(new Map());
  const [input, setInput] = useState(() => resolveHeldFlightAxes(held.current));
  const publish = useCallback(() => {
    const next = resolveHeldFlightAxes(held.current);
    setInput(next);
    onInputChange(next);
  }, [onInputChange]);
  const release = useCallback((id) => {
    if (held.current.delete(id)) publish();
  }, [publish]);
  const hold = (id, axis, value) => {
    held.current.set(id, { axis, value });
    publish();
  };

  useEffect(() => {
    const clear = () => { held.current.clear(); publish(); };
    const visibility = () => { if (document.hidden) clear(); };
    window.addEventListener('blur', clear);
    window.addEventListener('orientationchange', clear);
    window.addEventListener('pagehide', clear);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', clear);
      window.removeEventListener('orientationchange', clear);
      window.removeEventListener('pagehide', clear);
      document.removeEventListener('visibilitychange', visibility);
      held.current.clear();
      onInputChange(resolveHeldFlightAxes(held.current));
    };
  }, [onInputChange, publish, walking]);

  const button = (axis, value, label, children, className) => (
    <FlightButton axis={axis} value={value} label={label} hold={hold} release={release}
      active={axis === 'boost' || axis === 'fire' ? input[axis] > 0 : input[axis] === value} className={className}>{children}</FlightButton>
  );
  return (
    <div className="touch-flight-pad" role="group" aria-label="Touch flight controls">
      <div className="touch-flight-cluster">
        {walking ? button('z', 1, 'Walk forward', '↑') : button('z', 1, 'Fly forward', '↑')}
        <div className="touch-flight-row">
          {button('x', -1, 'Strafe left', '←')}
          {button('boost', 1, walking ? 'Hold to sprint' : 'Hold to boost', walking ? 'Sprint' : 'Boost', 'touch-flight-boost')}
          {button('x', 1, 'Strafe right', '→')}
        </div>
        {button('z', -1, walking ? 'Walk backward' : 'Fly backward', '↓')}
      </div>
      <p className="touch-look-hint">{walking ? "Drag to look around" : "Drag space to look"}</p>
      {!walking ? <div className="touch-flight-cluster vertical">
        <div className="touch-flight-actions">
          {button('fire', 1, 'Hold to fire', 'Fire', 'touch-flight-fire')}
          {button('brake', 1, 'Hold to brake', 'Brake', 'touch-flight-brake')}
        </div>
        {button('y', 1, 'Ascend', 'Ascend')}
        {button('y', -1, 'Descend', 'Descend')}
      </div> : null}
    </div>
  );
}
