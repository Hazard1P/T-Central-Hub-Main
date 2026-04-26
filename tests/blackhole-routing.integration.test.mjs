import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBlackholeBindingRegistry,
  resolveBlackholeRouteAtJumpCommit,
  buildBlackholeConnectivityAtlas,
} from '../lib/blackholeRoutingRegistry.js';

const nodes = [
  {
    key: 'deep_blackhole',
    kind: 'blackhole',
    target_server_id: 'arma3-cth-primary',
    fallback_server_id: 'rust-weekly-primary',
    mode_support: ['single_player', 'multi_player'],
    region: 'us-central',
  },
  {
    key: 'rust_gate',
    kind: 'blackhole',
    associatedServer: 'rust-weekly',
    target_server_id: 'rust-weekly-primary',
    fallback_server_id: 'arma3-cth-primary',
    mode_support: ['multi_player'],
    region: 'us-central',
  },
  {
    key: 'void_blackhole',
    kind: 'blackhole',
    target_server_id: null,
    fallback_server_id: null,
    mode_support: ['multi_player'],
    region: 'us-east',
  },
];

test('routing correctness: multiplayer routes to session-authoritative server, singleplayer routes to local-authoritative instance', () => {
  const registry = buildBlackholeBindingRegistry(nodes);

  const multiplayerCommit = resolveBlackholeRouteAtJumpCommit({
    blackholeId: 'deep_blackhole',
    mode: 'multi_player',
    registry,
    serverInstances: {
      'arma3-cth-primary': { id: 'arma3-cth-primary', authority: 'session-authoritative', healthy: true, region: 'us-central' },
      'rust-weekly-primary': { id: 'rust-weekly-primary', authority: 'session-authoritative', healthy: true, region: 'us-central' },
    },
  });

  assert.equal(multiplayerCommit.ok, true);
  assert.equal(multiplayerCommit.destination.id, 'arma3-cth-primary');

  const singleplayerCommit = resolveBlackholeRouteAtJumpCommit({
    blackholeId: 'deep_blackhole',
    mode: 'single_player',
    registry,
    serverInstances: {},
  });

  assert.equal(singleplayerCommit.ok, true);
  assert.match(singleplayerCommit.destination.id, /^private-local:deep_blackhole$/);
  assert.equal(singleplayerCommit.destination.authority, 'local-authoritative');
});

test('failover behavior: unhealthy primary uses fallback and marks degraded', () => {
  const registry = buildBlackholeBindingRegistry(nodes);
  const commit = resolveBlackholeRouteAtJumpCommit({
    blackholeId: 'deep_blackhole',
    mode: 'multi_player',
    registry,
    serverInstances: {
      'arma3-cth-primary': { id: 'arma3-cth-primary', authority: 'session-authoritative', healthy: false, region: 'us-central' },
      'rust-weekly-primary': { id: 'rust-weekly-primary', authority: 'session-authoritative', healthy: true, region: 'us-central' },
    },
  });

  assert.equal(commit.ok, true);
  assert.equal(commit.usedFallback, true);
  assert.equal(commit.status, 'degraded');
  assert.equal(commit.destination.id, 'rust-weekly-primary');
});

test('state handoff continuity keeps stable continuity key across jump commits', () => {
  const registry = buildBlackholeBindingRegistry(nodes);

  const initial = resolveBlackholeRouteAtJumpCommit({
    blackholeId: 'deep_blackhole',
    mode: 'multi_player',
    registry,
    serverInstances: {
      'arma3-cth-primary': { id: 'arma3-cth-primary', authority: 'session-authoritative', healthy: true, region: 'us-central' },
      'rust-weekly-primary': { id: 'rust-weekly-primary', authority: 'session-authoritative', healthy: true, region: 'us-central' },
    },
  });

  const followup = resolveBlackholeRouteAtJumpCommit({
    blackholeId: 'deep_blackhole',
    mode: 'multi_player',
    registry,
    serverInstances: {
      'arma3-cth-primary': { id: 'arma3-cth-primary', authority: 'session-authoritative', healthy: false, region: 'us-central' },
      'rust-weekly-primary': { id: 'rust-weekly-primary', authority: 'session-authoritative', healthy: true, region: 'us-central' },
    },
    previousCommit: initial,
  });

  assert.equal(followup.stateHandoff.continuity_key, initial.stateHandoff.continuity_key);
  assert.equal(followup.stateHandoff.destination_changed, true);
});

test('atlas connectivity includes per-blackhole healthy/degraded/offline status', () => {
  const atlas = buildBlackholeConnectivityAtlas({
    nodes,
    mode: 'multi_player',
    serverHealth: {
      'arma3-cth-primary': { healthy: false },
      'rust-weekly-primary': { healthy: true },
    },
  });

  assert.equal(atlas.connectivity.deep_blackhole.status, 'degraded');
  assert.equal(atlas.connectivity.rust_gate.status, 'healthy');
  assert.equal(atlas.connectivity.void_blackhole.status, 'offline');
});
