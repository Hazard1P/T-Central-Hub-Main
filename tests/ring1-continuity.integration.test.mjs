import test from 'node:test';
import assert from 'node:assert/strict';
import { attachRing1Continuity } from '../lib/ring1Continuity.js';

test('invokes ring1 reconciliation on handoff commits and returns ok continuity status', async () => {
  let captured = null;
  const runReconciliation = async (input) => {
    captured = input;
    return {
      degraded: false,
      reason: null,
      persistence: { ok: true, storage: 'supabase' },
    };
  };

  const payload = {
    ok: true,
    mode: 'multi_player',
    modeChanged: true,
    state: {
      playerCount: 3,
      projectiles: [{ id: 'p-1' }, { id: 'p-2' }],
      world: { combatHeat: 18 },
    },
  };

  const result = await attachRing1Continuity(payload, {
    roomName: 'arena-1',
    playerId: 'pilot-7',
    sessionToken: 'session-abc',
    requestedMode: 'multi_player',
    source: 'multiplayer:action',
    actionType: 'fire',
    runReconciliation,
  });

  assert.equal(Boolean(captured), true);
  assert.equal(captured.sessionContext.sessionId, 'session-abc');
  assert.equal(captured.sessionContext.roomName, 'arena-1');
  assert.equal(captured.gameplaySignals.playerCount, 3);
  assert.equal(captured.gameplaySignals.framePressure, 2);
  assert.equal(captured.gameplaySignals.conflictLoad, 18);

  assert.equal(result.continuity.status, 'ok');
  assert.equal(result.continuity.ring1.persistence.storage, 'supabase');
});

test('degrades gracefully when ring1 reconciliation throws without breaking route payload', async () => {
  const runReconciliation = async () => {
    throw new Error('meter backend unavailable');
  };

  const payload = {
    ok: true,
    status: 200,
    mode: 'single_player',
    modeChanged: true,
    state: {
      playerCount: 1,
      projectiles: [],
      world: { combatHeat: 0 },
    },
  };

  const result = await attachRing1Continuity(payload, {
    roomName: 'arena-2',
    playerId: 'pilot-9',
    sessionToken: 'session-def',
    requestedMode: 'single_player',
    source: 'multiplayer:state:post',
    runReconciliation,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.continuity.status, 'degraded');
  assert.equal(result.continuity.ring1.degraded, true);
  assert.match(result.continuity.ring1.reason, /meter backend unavailable/);
});

test('skips ring1 reconciliation when no handoff commit was recorded', async () => {
  let called = false;
  const runReconciliation = async () => {
    called = true;
    return { degraded: false };
  };

  const result = await attachRing1Continuity({ ok: true, modeChanged: false, state: {} }, {
    roomName: 'arena-3',
    source: 'multiplayer:state:post',
    runReconciliation,
  });

  assert.equal(called, false);
  assert.equal(result.continuity.status, 'skipped');
  assert.equal(result.continuity.ring1.reason, 'HANDOFF_NOT_COMMITTED');
});
