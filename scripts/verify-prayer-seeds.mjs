// Local integration check only: run the development server with the same test SESSION_SECRET.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { encryptJson } from '../lib/security.js';
import { createPrivacySummary } from '../lib/universePrivacyEngine.js';
import { PRAYER_RELIC_POSITION } from '../lib/prayerSeedDiscovery.js';

const base = new URL(process.env.APP_SMOKE_BASE_URL || 'http://127.0.0.1:3600');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Run only against a local test server.');
assert.ok(process.env.SESSION_SECRET, 'Supply a test-only SESSION_SECRET matching the test server.');
const suffix = randomUUID();
const accountId = 'seed-check-' + suffix;
const steamCookie = 'steam_session=' + encryptJson({ steamid: accountId, personaname: 'Seed test pilot' });
const googleCookie = 'google_session=' + encryptJson({ sub: accountId, name: 'Google seed pilot' });
const requestId = randomUUID();
const payload = { body: 'A private intention from the universe.', requestId, position: [...PRAYER_RELIC_POSITION], flightSignature: 'Q5D-halcyon', account_key: 'forged-owner', epoch_unix: 1, cyber_intelligence_id: 'forged-intelligence' };

async function call(cookie, body, extraHeaders = {}) {
  const response = await fetch(new URL('/api/universe/prayer-seeds', base), { method: body ? 'POST' : 'GET', headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json', Origin: base.origin } : {}), ...extraHeaders }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  assert.match(response.headers.get('cache-control'), /private.*no-store/);
  return { response, data };
}

assert.equal((await call(null)).response.status, 401);
assert.equal((await call(null, payload)).response.status, 401);
assert.equal((await call('steam_session=forged')).response.status, 401);
assert.equal((await call(steamCookie, { ...payload, position: [0, 0, 18] })).response.status, 400);
assert.equal((await call(steamCookie, { ...payload, body: 'x'.repeat(321) })).response.status, 400);
assert.equal((await call(steamCookie, payload, { Origin: 'https://another-site.invalid' })).response.status, 403);

const before = Math.floor(Date.now() / 1000);
const saved = await call(steamCookie, payload);
assert.equal(saved.response.status, 200);
assert.equal(saved.data.seed.account_key, 'steam:' + accountId);
assert.ok(saved.data.seed.epoch_unix >= before && saved.data.seed.epoch_unix <= Math.floor(Date.now() / 1000));
assert.equal(saved.data.seed.epoch_anchor.unix, saved.data.seed.epoch_unix);
const retried = await call(steamCookie, { ...payload, body: 'A changed retry must not overwrite.' });
assert.equal(retried.data.seed.id, saved.data.seed.id);
assert.equal(retried.data.seed.body, payload.body);
assert.equal((await call(googleCookie)).data.total, 0);
const otherSteamCookie = 'steam_session=' + encryptJson({ steamid: accountId + '-other', personaname: 'Other pilot' });
assert.equal((await call(otherSteamCookie)).data.total, 0);
assert.equal((await call(googleCookie, payload)).response.status, 200);
const steam = (await call(steamCookie)).data;
const google = (await call(googleCookie)).data;
assert.equal(steam.total, 1);
assert.equal(google.total, 1);
assert.notEqual(steam.intelligence.id, google.intelligence.id);
assert.equal(steam.seeds[0].cyber_intelligence_id, steam.intelligence.id);
assert.equal(google.seeds[0].cyber_intelligence_id, google.intelligence.id);

const auth = { authenticated: true, provider: 'steam', accountId, displayName: 'Seed test pilot' };
const scope = createPrivacySummary({ authContext: auth, lobbyMode: 'private' }).storageKey;
const plantedAt = '2025-07-13T16:44:00.000Z';
const legacy = encryptJson([
  { id: 'old-owner-seed-001', body: 'An earlier prayer.', plantedAt, scope, plantedBy: { steamid: accountId } },
  { id: 'old-other-seed-002', body: 'Another owner must stay private.', plantedAt, scope, plantedBy: { steamid: 'different-account' } },
]);
const migrationCookie = steamCookie + '; universe_prayer_seeds=' + legacy;
const recovered = (await call(migrationCookie)).data;
assert.equal(recovered.total, 2);
assert.equal(recovered.seeds.find((entry) => entry.flight_signature === 'legacy-cookie').epoch_unix, Date.parse(plantedAt) / 1000);
assert.equal((await call(migrationCookie)).data.total, 2);
assert.ok(recovered.seeds.every((entry) => entry.account_key === 'steam:' + accountId));
console.log('Prayer Seed API passed: authenticated ownership, provider isolation, epoch binding, retries, discovery validation, private caching and legacy recovery.');
