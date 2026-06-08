import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

async function loadStepFrameModule() {
  const source = readFileSync(new URL('../lib/simCore/stepFrame.js', import.meta.url), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

test('ship controls document the nose-forward positive Z flight convention', () => {
  const stableWorld = readFileSync(new URL('../components/StableSystemWorld.js', import.meta.url), 'utf8');
  const shipEngine = readFileSync(new URL('../lib/shipEngine.js', import.meta.url), 'utf8');

  assert.match(stableWorld, /const SHIP_MODEL_FORWARD = new THREE\.Vector3\(0, 0, 1\)/);
  assert.match(stableWorld, /KeyW \|\| keys\.current\.ArrowUp \? 1 : 0/);
  assert.match(stableWorld, /setAxis\('z', 1\).*?>↑<\/button>/);
  assert.match(shipEngine, /const forward = \(input\.forward \? 1 : 0\) - \(input\.backward \? 1 : 0\)/);
});

test('stepFrame preserves boost magnitude while capping diagonal control input', async () => {
  const { stepFrame } = await loadStepFrameModule();
  const basePayload = {
    position: [0, 0, 18],
    velocity: [0, 0, 0],
    dt: 1 / 60,
    gravitySources: [{ key: 'test-zero-gravity', mass: 0, position: [0, 0, 0] }],
    profile: 'multiplayer',
  };

  const unboosted = stepFrame({ ...basePayload, controlVector: [0, 0, 1] });
  const boosted = stepFrame({ ...basePayload, controlVector: [0, 0, 1.75] });
  const diagonalBoosted = stepFrame({ ...basePayload, controlVector: [1.75, 0, 1.75] });

  assert.ok(boosted.velocity[2] > unboosted.velocity[2], 'boosted forward input should produce a larger forward velocity delta');
  assert.ok(diagonalBoosted.velocity[2] < boosted.velocity[2], 'diagonal boosted input should be magnitude-capped instead of preserving full per-axis boost');
  assert.ok(Math.abs(diagonalBoosted.velocity[0] - diagonalBoosted.velocity[2]) <= 0.0001, 'diagonal cap should preserve direction balance');
});
