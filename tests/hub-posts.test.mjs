import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHubPostRecord, normalizeHubPostPayload } from '../lib/hubPosts.js';

test('hub post payload trims required fields and rejects unsupported categories', () => {
  const payload = normalizeHubPostPayload({
    topic: '  Server event  ',
    category: 'Unexpected lane',
    message: '  Bring friends.  ',
  });

  assert.equal(payload.topic, 'Server event');
  assert.equal(payload.category, 'General');
  assert.equal(payload.message, 'Bring friends.');
  assert.equal(payload.valid, true);
});

test('hub post records can be authored by Steam sessions', () => {
  const result = buildHubPostRecord({
    body: { topic: 'Rust wipe', category: 'Events', message: 'Monthly wipe prep is ready.' },
    auth: { steamUser: { steamid: '76561198000000000', personaname: 'Steam Tester', avatar: 'https://example.test/avatar.jpg' } },
    now: new Date('2026-06-08T00:00:00.000Z'),
    reference: 'HB-STEAM',
  });

  assert.equal(result.ok, true);
  assert.equal(result.record.reference, 'HB-STEAM');
  assert.equal(result.record.author.provider, 'steam');
  assert.equal(result.record.author.accountId, '76561198000000000');
  assert.equal(result.record.author.displayName, 'Steam Tester');
  assert.equal(result.record.createdAt, '2026-06-08T00:00:00.000Z');
});

test('hub post records can be authored by Google sessions', () => {
  const result = buildHubPostRecord({
    body: { topic: 'Feature idea', category: 'Feature idea', message: 'Add a build-night RSVP thread.' },
    auth: { googleUser: { sub: 'google-123', name: 'Google Tester', email: 'tester@example.test', email_verified: true } },
    now: new Date('2026-06-08T00:00:00.000Z'),
    reference: 'HB-GOOGLE',
  });

  assert.equal(result.ok, true);
  assert.equal(result.record.reference, 'HB-GOOGLE');
  assert.equal(result.record.author.provider, 'google');
  assert.equal(result.record.author.accountId, 'google-123');
  assert.equal(result.record.author.displayName, 'Google Tester');
  assert.equal(result.record.author.emailVerified, true);
});

test('hub post records require an authenticated Steam or Google identity', () => {
  const result = buildHubPostRecord({
    body: { topic: 'Anonymous', message: 'Should not post.' },
    auth: {},
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'AUTH_REQUIRED');
});
