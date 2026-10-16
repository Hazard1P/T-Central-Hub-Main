import test from 'node:test';
import assert from 'node:assert/strict';
import { joinAuthoritativeRoom, updateAuthoritativePlayer } from '../lib/authoritativeMultiplayerStore.js';

test('a guest can join a room and advance authoritative flight simulation', () => {
  const roomName = 'flight-regression';
  const session = joinAuthoritativeRoom({ roomName, identity: { id: 'guest-flight-test' } });
  assert.equal(session.ok, true);
  assert.ok(session.token);
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
