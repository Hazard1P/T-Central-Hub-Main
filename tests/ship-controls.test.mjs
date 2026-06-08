import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('ship controls document the nose-forward positive Z flight convention', () => {
  const stableWorld = readFileSync(new URL('../components/StableSystemWorld.js', import.meta.url), 'utf8');
  const shipEngine = readFileSync(new URL('../lib/shipEngine.js', import.meta.url), 'utf8');

  assert.match(stableWorld, /const SHIP_MODEL_FORWARD = new THREE\.Vector3\(0, 0, 1\)/);
  assert.match(stableWorld, /KeyW \|\| keys\.current\.ArrowUp \? 1 : 0/);
  assert.match(stableWorld, /setAxis\('z', 1\).*?>↑<\/button>/);
  assert.match(shipEngine, /const forward = \(input\.forward \? 1 : 0\) - \(input\.backward \? 1 : 0\)/);
});
