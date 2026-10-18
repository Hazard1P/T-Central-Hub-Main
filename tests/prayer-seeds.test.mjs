import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createBoundPrayerSeed, createCyberIntelligence, getSeedOwner, validateSeedInput } from '../lib/server/prayerSeedRecords.js';
import { createPrayerSeedRepository } from '../lib/server/prayerSeedRepository.js';
import { isNearPrayerRelic, PRAYER_RELIC_POSITION } from '../lib/prayerSeedDiscovery.js';
import { getExplorationDestinations, getApproachPoint } from '../lib/exploration.js';

const steam = { authenticated: true, provider: 'steam', accountId: 'test-account', displayName: 'Explorer' };
const google = { ...steam, provider: 'google' };
const input = (requestId = 'discovery-request-001') => ({ body: 'Let curiosity guide this journey.', requestId, position: [...PRAYER_RELIC_POSITION], flightSignature: 'Q5D-halcyon' });

test('a hidden relic is reachable at Halcyon, absent from public destinations, and rejects malformed positions', () => {
  const destinations = getExplorationDestinations([]);
  assert.ok(destinations.every((entry) => !/prayer|relic|quiet.signal/i.test(entry.key + entry.label)));
  const halcyon = destinations.find((entry) => entry.key === 'halcyon');
  assert.ok(isNearPrayerRelic(getApproachPoint([0, 0, 18], halcyon)));
  for (const position of [null, [], [0, 0, 0], ['18.7', 8.3, 60], [NaN, 8, 60], [Infinity, 0, 60]]) assert.equal(isNearPrayerRelic(position), false);
});

test('account identity is provider-specific; guest and unsupported identities cannot own seeds', () => {
  assert.notEqual(getSeedOwner(steam), getSeedOwner(google));
  for (const auth of [{}, { ...steam, authenticated: false }, { ...steam, provider: 'guest' }]) assert.throws(() => getSeedOwner(auth), { status: 401 });
});

test('input preserves only words, discovery request and flight signature; forged account and epoch are discarded', () => {
  const normalized = validateSeedInput({ ...input(), account_key: 'attacker', epoch_unix: 1, cyber_intelligence_id: 'stolen', body: '  A small prayer.  ' });
  assert.deepEqual(Object.keys(normalized).sort(), ['body', 'flightSignature', 'requestId']);
  assert.equal(normalized.body, 'A small prayer.');
  for (const patch of [{ body: '' }, { body: 'x'.repeat(321) }, { position: [0, 0, 18] }, { requestId: '../bad' }, { flightSignature: '<script>' }]) assert.throws(() => validateSeedInput({ ...input(), ...patch }), { status: 400 });
});

test('the server binds words and flight signature to the account cyber-intelligence and actual Unix epoch', () => {
  const now = Date.parse('2026-10-18T12:34:56.789Z');
  const profile = createCyberIntelligence(steam, now);
  const seed = createBoundPrayerSeed(steam, profile, validateSeedInput(input()), now);
  assert.equal(seed.epoch_unix, Math.floor(now / 1000));
  assert.equal(seed.epoch_anchor.unix, seed.epoch_unix);
  assert.equal(seed.created_at, new Date(now).toISOString());
  assert.equal(seed.cyber_intelligence_id, profile.id);
  assert.equal(seed.account_key, 'steam:test-account');
  assert.equal(seed.kind, 'In-Prayer-Intelligence');
  assert.match(seed.binding_hash, /^[a-f0-9]{64}$/);
  assert.throws(() => createBoundPrayerSeed(google, profile, input(), now), { status: 403 });
});

test('account collection survives restart, isolates providers, and concurrent retries create one immutable seed', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'prayer-seeds-'));
  try {
    const localPath = path.join(directory, 'vault.json');
    const store = createPrayerSeedRepository({ localPath });
    const results = await Promise.all(Array.from({ length: 8 }, () => store.save(steam, validateSeedInput(input()))));
    assert.equal(new Set(results.map((result) => result.seed.id)).size, 1);
    const first = await store.load(steam);
    assert.equal(first.total, 1);
    assert.equal((await store.load(google)).total, 0);
    const retry = await store.save(steam, validateSeedInput({ ...input(), body: 'Changed retry' }));
    assert.equal(retry.seed.body, first.seeds[0].body);
    await assert.rejects(store.save(steam, validateSeedInput(input('discovery-request-002'))), { status: 429 });
    await store.save(google, validateSeedInput(input()));
    const restarted = createPrayerSeedRepository({ localPath });
    const restored = await restarted.load(steam);
    assert.equal(restored.intelligence.id, first.intelligence.id);
    assert.deepEqual(restored.seeds, first.seeds);
    assert.notEqual((await restarted.load(google)).intelligence.id, first.intelligence.id);
    await restarted.save(steam, validateSeedInput(input('discovery-request-003')), { now: Date.now() + 6000 });
    assert.equal((await restarted.load(steam)).intelligence.id, first.intelligence.id);
    assert.equal((await restarted.load(steam)).total, 2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('unavailable or corrupt storage never reports a successful save or erases the old data', async () => {
  await assert.rejects(createPrayerSeedRepository().save(steam, input()), { status: 503 });
  await assert.rejects(createPrayerSeedRepository().load(steam), { status: 503 });
  const directory = await mkdtemp(path.join(os.tmpdir(), 'prayer-corrupt-'));
  try {
    const localPath = path.join(directory, 'vault.json');
    await writeFile(localPath, 'corrupt-but-preserve-this');
    await assert.rejects(createPrayerSeedRepository({ localPath }).save(steam, input()), { status: 503 });
    assert.equal(await readFile(localPath, 'utf8'), 'corrupt-but-preserve-this');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
