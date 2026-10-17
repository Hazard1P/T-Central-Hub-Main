import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGuestPilotSession } from '../lib/guestPilotIdentity.js';

test('independent guest browsers get distinct opaque credentials and public pilot IDs', () => {
  const first = resolveGuestPilotSession();
  const second = resolveGuestPilotSession();
  assert.notEqual(first.value, second.value);
  assert.notEqual(first.id, second.id);
  assert.ok(!first.id.includes(first.value));
  assert.equal(first.setCookie, true);
});

test('a guest resumes from its own cookie, while a public roster ID cannot resume that guest', () => {
  const first = resolveGuestPilotSession();
  const resumed = resolveGuestPilotSession(first.value);
  assert.equal(resumed.id, first.id);
  assert.equal(resumed.setCookie, false);
  const impersonator = resolveGuestPilotSession(first.id);
  assert.notEqual(impersonator.id, first.id);
  assert.equal(impersonator.setCookie, true);
});
