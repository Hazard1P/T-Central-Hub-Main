import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveHeldFlightAxes, shouldIgnoreFlightKey } from '../lib/flightInput.js';
import { gameEngine } from '../lib/gameEngine.js';

test('simultaneous flight pointers release independently and opposite directions cancel', () => {
  const held = new Map([
    [1, { axis: 'z', value: 1 }],
    [2, { axis: 'boost', value: 1 }],
    [3, { axis: 'y', value: -1 }],
  ]);
  assert.deepEqual(resolveHeldFlightAxes(held), { x: 0, y: -1, z: 1, boost: 1, fire: 0 });
  held.set(5, { axis: 'fire', value: 1 });
  assert.equal(resolveHeldFlightAxes(held).fire, 1);
  held.delete(5);
  held.delete(2);
  assert.deepEqual(resolveHeldFlightAxes(held), { x: 0, y: -1, z: 1, boost: 0, fire: 0 });
  held.set(4, { axis: 'z', value: -1 });
  assert.equal(resolveHeldFlightAxes(held).z, 0);
  held.delete(1);
  assert.equal(resolveHeldFlightAxes(held).z, -1);
  held.clear();
  assert.deepEqual(resolveHeldFlightAxes(held), { x: 0, y: 0, z: 0, boost: 0, fire: 0 });
});

test('flight input leaves text editing, controls, and browser shortcuts alone', () => {
  assert.equal(shouldIgnoreFlightKey({ target: { isContentEditable: true } }), true);
  assert.equal(shouldIgnoreFlightKey({ target: { closest: () => ({ tagName: 'INPUT' }) } }), true);
  assert.equal(shouldIgnoreFlightKey({ metaKey: true }), true);
  assert.equal(shouldIgnoreFlightKey({ altKey: true }), true);
  assert.equal(shouldIgnoreFlightKey({ defaultPrevented: true }), true);
  assert.equal(shouldIgnoreFlightKey({ ctrlKey: true }), false, 'Control remains available for boost');
});

test('HUD shortcuts initialize once, ignore repeats, and detach when leaving the simulation', (t) => {
  const previousWindow = globalThis.window;
  globalThis.window = new EventTarget();
  t.after(() => { gameEngine.destroy(); globalThis.window = previousWindow; });
  const key = (properties = {}) => {
    const event = new Event('keydown', { cancelable: true });
    for (const [name, value] of Object.entries({ key: 'h', ...properties })) Object.defineProperty(event, name, { value });
    window.dispatchEvent(event);
  };
  gameEngine.init();
  gameEngine.init();
  key();
  assert.equal(gameEngine.state.hudVisible, false, 'duplicate initialization must not double-toggle');
  key({ repeat: true });
  assert.equal(gameEngine.state.hudVisible, false);
  key({ ctrlKey: true });
  assert.equal(gameEngine.state.hudVisible, false, 'Control+H remains a browser shortcut');
  key({ target: { isContentEditable: true } });
  assert.equal(gameEngine.state.hudVisible, false);
  gameEngine.destroy();
  assert.equal(gameEngine.state.initialized, false);
  key();
  assert.equal(gameEngine.state.hudVisible, true, 'detached shortcut cannot change other pages');
  gameEngine.init();
  key();
  assert.equal(gameEngine.state.hudVisible, false, 're-entering restores one working shortcut');
});
