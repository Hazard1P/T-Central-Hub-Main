export const FLIGHT_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF', 'KeyX',
  'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

export function isInteractiveTarget(target) {
  return Boolean(target?.isContentEditable || target?.closest?.(
    'input, textarea, select, button, a, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"], [role="dialog"]'
  ));
}

export function shouldIgnoreFlightKey(event) {
  return event.defaultPrevented || event.metaKey || event.altKey || isInteractiveTarget(event.target);
}

// Resolve simultaneous pointers independently: lifting one finger must not release another.
export function resolveHeldFlightAxes(held) {
  const input = { x: 0, y: 0, z: 0, boost: 0 };
  for (const { axis, value } of held.values()) {
    if (Object.hasOwn(input, axis) && Number.isFinite(value)) input[axis] += value;
  }
  for (const axis of ['x', 'y', 'z']) input[axis] = Math.max(-1, Math.min(1, input[axis]));
  input.boost = input.boost > 0 ? 1 : 0;
  return input;
}
