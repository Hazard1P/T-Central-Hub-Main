import test from 'node:test';
import assert from 'node:assert/strict';
import { joinAuthoritativeRoom, updateAuthoritativePlayer, getAuthoritativeState, disconnectAuthoritativePlayer } from '../lib/authoritativeMultiplayerStore.js';

test('a guest can join a room and advance authoritative flight simulation', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 2000000 });
  t.after(() => t.mock.timers.reset());
  const roomName = 'flight-regression';
  const session = joinAuthoritativeRoom({ roomName, identity: { id: 'guest-flight-test' } });
  assert.equal(session.ok, true);
  assert.ok(session.token);
  t.mock.timers.tick(100);
  const result = updateAuthoritativePlayer({
    roomName,
    id: session.player.id,
    token: session.token,
    snapshot: { controlVector: [0, 0, 1], direction: [0, 0, 1], dt: 0.1, nearest: 'deep_blackhole' },
  });
  assert.equal(result.ok, true);
  const player = result.state.players.find((player) => player.id === session.player.id);
  assert.ok(player.position.every(Number.isFinite));
  assert.notDeepEqual(player.position, session.player.position);
});

test('pilots see each other move, stay isolated across rooms, and leave immediately with a valid session', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000000 });
  t.after(() => t.mock.timers.reset());
  const roomName = 'exploration-pair';
  const first = joinAuthoritativeRoom({ roomName, identity: { id: 'pilot-a' } });
  const second = joinAuthoritativeRoom({ roomName, identity: { id: 'pilot-b' } });
  const other = joinAuthoritativeRoom({ roomName: 'other-room', identity: { id: 'pilot-c' } });
  assert.notDeepEqual(first.player.position, second.player.position);
  t.mock.timers.tick(250);
  const movement = updateAuthoritativePlayer({ roomName, id: first.player.id, token: first.token, snapshot: { inputs: Array.from({ length: 15 }, (_, i) => ({ frameIndex: i + 1, dt: 1 / 60, controlVector: [0, 0, 1] })) } });
  assert.equal(movement.ok, true);
  const seen = getAuthoritativeState({ roomName, id: second.player.id, token: second.token });
  assert.equal(seen.state.playerCount, 2);
  assert.notDeepEqual(seen.state.players.find((pilot) => pilot.id === first.player.id).position, first.player.position);
  assert.equal(getAuthoritativeState({ roomName: 'other-room', id: other.player.id, token: other.token }).state.playerCount, 1);
  assert.equal(disconnectAuthoritativePlayer({ roomName, id: first.player.id, token: second.token }).status, 401);
  assert.equal(disconnectAuthoritativePlayer({ roomName, id: first.player.id, token: first.token }).ok, true);
  assert.equal(getAuthoritativeState({ roomName, id: second.player.id, token: second.token }).state.playerCount, 1);
  assert.equal(updateAuthoritativePlayer({ roomName, id: first.player.id, token: first.token }).status, 401);
});
