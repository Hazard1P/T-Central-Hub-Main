import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHubPostRecord, normalizeHubPostPayload, publicHubPost } from '../lib/hubPosts.js';

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
    auth: { googleUser: { sub: 'google-123', name: 'Private Legal Name', gamertag: 'Google_Tester', email: 'tester@example.test', email_verified: true } },
    now: new Date('2026-06-08T00:00:00.000Z'),
    reference: 'HB-GOOGLE',
  });

  assert.equal(result.ok, true);
  assert.equal(result.record.reference, 'HB-GOOGLE');
  assert.equal(result.record.author.provider, 'google');
  assert.equal(result.record.author.accountId, 'google-123');
  assert.equal(result.record.author.displayName, 'Google_Tester');
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

test('public posts omit authentication identifiers, email and unrecognized stored fields', () => {
  const { record } = buildHubPostRecord({
    body: { topic: 'Public topic', message: 'Public message' },
    auth: { googleUser: { sub: 'private-sub', name: 'Private Legal Name', gamertag: 'Pilot', email: 'private@example.test', email_verified: true } },
  });
  record.author.futurePrivateField = 'private-token';
  record.privateModeratorNotes = 'private-notes';
  const publicRecord = publicHubPost(record);
  assert.equal(publicRecord.message, 'Public message');
  assert.equal(publicRecord.author.displayName, 'Pilot');
  assert.deepEqual(Object.keys(publicRecord.author).sort(), ['avatar', 'displayName', 'profileurl', 'provider']);
  assert.doesNotMatch(JSON.stringify(publicRecord), /private-/);
  assert.doesNotMatch(JSON.stringify(publicRecord), /private@example/);
  assert.equal(record.author.email, 'private@example.test');
});

test('missing names and legacy email fallback names do not expose Google email', () => {
  const { record } = buildHubPostRecord({
    body: { topic: 'Topic', message: 'Message' },
    auth: { googleUser: { sub: '123', email: 'private@example.test' } },
  });
  assert.equal(record.author.displayName, 'Google Pilot');
  record.author.displayName = record.author.email;
  assert.equal(publicHubPost(record).author.displayName, 'Community Pilot');
});

test('headings and subheadings persist in the public post without changing the body', () => {
  const result = buildHubPostRecord({ body: { topic: '  Build night  ', subheading: '  A shared exploration event  ', message: 'Line one\nLine two', category: 'Events' }, auth: { googleUser: { sub: 'g-1', name: 'Pilot' } } });
  const visible = publicHubPost(result.record);
  assert.equal(visible.topic, 'Build night');
  assert.equal(visible.subheading, 'A shared exploration event');
  assert.equal(visible.message, 'Line one\nLine two');
  assert.equal(visible.category, 'Events');
  assert.equal(publicHubPost({ author: {} }).subheading, '');
  assert.equal(normalizeHubPostPayload({ subheading: 's'.repeat(300) }).subheading.length, 180);
});

test('posts created in the same millisecond have distinct references', () => {
  const input = { body: { topic: 'Topic', message: 'Body' }, auth: { steamUser: { steamid: '1' } }, now: new Date(0) };
  const references = Array.from({ length: 50 }, () => buildHubPostRecord(input).record.reference);
  assert.equal(new Set(references).size, 50);
});
