import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDirectoryServers, createServerDirectoryLoader } from '../lib/serverDirectory.js';

const server = (id, overrides = {}) => ({ id, attributes: { status: 'online', rank: 12, name: 'Community', ip: '203.0.113.5', port: 28015, players: 35, maxPlayers: 100, details: { map: 'Test map' }, ...overrides }, relationships: { game: { data: { id: 'rust' } } } });

test('directory shows ranked populated online servers and safe provider-derived links only', () => {
  const data = { data: [server('1'), server('2', { rank: 3 }), server('3', { status: 'offline' }), server('4', { players: 0 }), server('5', { ip: 'evil.test/path?x=' }), server('6', { port: -1 }), server('7', { rank: null }), server('bad/id')] };
  const result = normalizeDirectoryServers(data, 'rust');
  assert.deepEqual(result.map((entry) => entry.id), ['2', '1']);
  assert.equal(result[0].address, '203.0.113.5:28015');
  assert.equal(result[0].detailsUrl, 'https://www.battlemetrics.com/servers/rust/2');
  assert.equal(normalizeDirectoryServers(data, 'arma3').length, 0);
  assert.equal(normalizeDirectoryServers(data, '__proto__').length, 0);
});

test('directory shares concurrent fetches, caches within a minute and marks failed refreshes stale', async () => {
  let calls = 0, timestamp = 1000, broken = false;
  const load = createServerDirectoryLoader({ now: () => timestamp, fetchImpl: async (url) => {
    calls += 1;
    assert.equal(url.hostname, 'api.battlemetrics.com');
    assert.equal(url.searchParams.get('filter[game]'), 'rust');
    if (broken) throw new Error('network unavailable');
    return { ok: true, json: async () => ({ data: [server('1')] }) };
  } });
  const results = await Promise.all([load('rust'), load('rust')]);
  assert.equal(calls, 1); assert.equal(results[0].mode, 'live');
  await load('rust'); assert.equal(calls, 1);
  timestamp += 61000; broken = true;
  const stale = await load('rust');
  assert.equal(stale.mode, 'stale'); assert.equal(stale.checkedAt, results[0].checkedAt);
  assert.equal(stale.servers[0].id, '1'); assert.equal(calls, 2);
  await assert.rejects(load('__proto__'), /Unsupported game/);
});

test('a failed first check does not invent an active server or poison retries', async () => {
  let fail = true;
  const load = createServerDirectoryLoader({ fetchImpl: () => {
    if (fail) throw new Error('Blocked');
    return Promise.resolve({ ok: true, json: async () => ({ data: [server('1')] }) });
  } });
  const unavailable = await load('rust');
  assert.equal(unavailable.ok, false); assert.equal(unavailable.mode, 'unavailable'); assert.deepEqual(unavailable.servers, []);
  fail = false;
  assert.equal((await load('rust')).mode, 'live');
});
