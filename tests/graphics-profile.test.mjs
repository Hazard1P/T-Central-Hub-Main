import test from 'node:test';
import assert from 'node:assert/strict';
import { getGraphicsProfile } from '../lib/graphicsProfile.js';

test('automatic mobile rendering bounds resolution and disables multipass bloom', () => {
  const mobile = getGraphicsProfile('auto', { isMobile: true });
  const desktop = getGraphicsProfile('auto');
  assert.equal(mobile.bloom, false);
  assert.equal(desktop.bloom, true);
  assert.ok(mobile.dpr[1] <= 1.2);
  assert.ok(mobile.asteroids < desktop.asteroids);
  assert.ok(mobile.stars < desktop.stars);
});

test('manual performance mode applies on desktop and reduced motion freezes scenery', () => {
  const profile = getGraphicsProfile('performance', { reducedMotion: true });
  assert.equal(profile.bloom, false);
  assert.equal(profile.animate, false);
  assert.equal(profile.dpr[1], 1);
  assert.equal(getGraphicsProfile('high', { isMobile: true }).bloom, true);
});
