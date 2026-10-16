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

export default function TouchFlightPad({ onInputChange }) {
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
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
      held.current.clear();
      onInputChange(resolveHeldFlightAxes(held.current));
    };
  }, [onInputChange, publish]);

  const button = (axis, value, label, children, className) => (
    <FlightButton axis={axis} value={value} label={label} hold={hold} release={release}
      active={axis === 'boost' ? input.boost > 0 : input[axis] === value} className={className}>{children}</FlightButton>
  );
  return (
    <div className="touch-flight-pad" role="group" aria-label="Touch flight controls">
      <div className="touch-flight-cluster">
        {button('z', 1, 'Fly forward', '↑')}
        <div className="touch-flight-row">
          {button('x', -1, 'Strafe left', '←')}
          {button('boost', 1, 'Hold to boost', 'Boost', 'touch-flight-boost')}
          {button('x', 1, 'Strafe right', '→')}
        </div>
        {button('z', -1, 'Fly backward', '↓')}
      </div>
      <p className="touch-look-hint">Drag space to look</p>
      <div className="touch-flight-cluster vertical">
        {button('y', 1, 'Ascend', 'Ascend')}
        {button('y', -1, 'Descend', 'Descend')}
      </div>
    </div>
  );
}
