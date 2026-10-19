import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPLORATION_LANDMARKS, getApproachPoint, getCruiseControl, getExplorationDestinations, distanceBetween, isValidRoomName, getPilotSpawn } from '../lib/exploration.js';
import { buildGravitySourcesFromSeed, stepFrame } from '../lib/simCore/stepFrame.js';
import { advanceFlightBatch } from '../lib/simCore/flightBatch.js';

test('cruise reaches a planetary viewing point through bounded thrust and stops outside the rings', () => {
  const planet = EXPLORATION_LANDMARKS.find((node) => node.key === 'halcyon');
  let state = { position: [0, 0, 18], velocity: [0, 0, 0], gravity: [0, 0, 0] };
  const target = getApproachPoint(state.position, planet);
  const gravitySources = buildGravitySourcesFromSeed('exploration-test');
  for (let frame = 0; frame < 1800; frame++) {
    const controlVector = getCruiseControl({ ...state, target });
    assert.ok(Math.hypot(...controlVector) <= 1.75001);
    state = stepFrame({ ...state, controlVector, dt: 1 / 60, gravitySources });
    assert.ok(distanceBetween(state.position, planet.position) > planet.radius * 2.05, 'stay outside the ring system');
  }
  assert.ok(distanceBetween(state.position, target) < .8);
  assert.ok(Math.hypot(...state.velocity) < .7);
});

test('shared input batches reproduce rendered flight and acknowledge each frame only once', () => {
  const gravitySources = [{ mass: 0, position: [0, 0, 0] }];
  let rendered = { position: [0, 0, 18], velocity: [0, 0, 0] };
  const inputs = Array.from({ length: 15 }, (_, i) => ({ frameIndex: i + 1, dt: 1 / 60, controlVector: i < 8 ? [1, 0, 1] : [-1, 0, 0] }));
  for (const frame of inputs) rendered = stepFrame({ ...rendered, ...frame, gravitySources });
  const payload = { position: [0, 0, 18], velocity: [0, 0, 0], snapshot: { inputs }, elapsed: .25, gravitySources };
  const shared = advanceFlightBatch(payload);
  assert.deepEqual(shared.position, rendered.position);
  assert.deepEqual(shared.velocity, rendered.velocity);
  assert.equal(shared.frameIndex, 15);
  const repeated = advanceFlightBatch({ ...payload, ...shared });
  assert.deepEqual(repeated.position, shared.position);
  assert.equal(repeated.frameIndex, 15);
});

test('the server time budget bounds batch fast-forward, rejects invalid steps, and accepts high-refresh input', () => {
  const base = { position: [0, 0, 18], velocity: [0, 0, 0], gravitySources: [{ mass: 0, position: [0, 0, 0] }] };
  const inputs = Array.from({ length: 60 }, (_, i) => ({ frameIndex: i + 1, dt: 1 / 60, controlVector: [0, 0, 1] }));
  assert.equal(advanceFlightBatch({ ...base, snapshot: { inputs }, elapsed: .1 }).frameIndex, 6);
  assert.equal(advanceFlightBatch({ ...base, snapshot: { inputs }, elapsed: 0 }).frameIndex, 0);
  assert.deepEqual(advanceFlightBatch({ ...base, snapshot: { controlVector: [0, 0, 1], frameIndex: 99 }, elapsed: 0 }).position, base.position, 'legacy clients also need elapsed server time');
  assert.equal(advanceFlightBatch({ ...base, snapshot: { inputs: [{ ...inputs[0], dt: 5 }] }, elapsed: 1 }).frameIndex, 0);
  assert.equal(advanceFlightBatch({ ...base, snapshot: { inputs: [{ ...inputs[0], dt: 1 / 144 }] }, elapsed: .1 }).frameIndex, 1);
});

test('shared room names fit the API contract without accepting URL or header characters', () => {
  assert.equal(isValidRoomName('friends-flight_1'), true);
  for (const name of ['', 'a'.repeat(65), '../room', 'room?token=x', 'room\nnext']) assert.equal(isValidRoomName(name), false);
});

test('planet cruise endpoints extend past the former local bounds and remain outside the planet', () => {
  const planet = EXPLORATION_LANDMARKS.find((node) => node.key === 'pelagos');
  const point = getApproachPoint([-44, -12, 159], planet);
  assert.ok(point[2] > 160, 'the old 160-unit boundary must not compress the world');
  assert.ok(distanceBetween(point, planet.position) > planet.radius);
});

test('the destination catalog exposes physical anchors and owned solo assets while keeping sealed controls out', () => {
  const nodes = [{ key: 'deep', kind: 'blackhole', playableDatapoint: true }, { key: 'owned', kind: 'solar', privateOnly: true }, { key: 'sealed', kind: 'dyson', playerInteractive: false }, { key: 'relay', kind: 'node', generated: true }];
  const keys = getExplorationDestinations(nodes).map((node) => node.key);
  assert.ok(keys.includes('deep') && keys.includes('owned') && keys.includes('halcyon'));
  assert.ok(!keys.includes('sealed') && !keys.includes('relay'));
  assert.notDeepEqual(getPilotSpawn('pilot-a'), getPilotSpawn('pilot-b'));
});
