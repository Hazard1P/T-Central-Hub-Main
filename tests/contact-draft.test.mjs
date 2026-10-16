import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContactDraft, CONTACT_EMAIL } from '../lib/contact.js';

test('email drafts keep special characters and multiline text inside encoded values', () => {
  const message = 'Arma & Steam?\nA + B = 100% 🚀\n&bcc=other@example.com';
  const draft = buildContactDraft({ topic: 'Server or simulation help', subject: 'Cannot join & launch?', message, name: 'A Player', email: 'player@example.com' });
  const url = new URL(draft.href);
  assert.equal(url.pathname, CONTACT_EMAIL);
  assert.deepEqual([...url.searchParams.keys()], ['subject', 'body']);
  assert.equal(url.searchParams.get('subject'), '[T-Central] Cannot join & launch?');
  assert.equal(url.searchParams.get('body'), `Topic: Server or simulation help\n\n${message}\n\nName: A Player\nReply email: player@example.com`);
});

test('drafts work without optional personal details and do not include blank sender fields', () => {
  const draft = buildContactDraft({ subject: '  Quick question  ', message: '  Hello team!  ' });
  assert.equal(draft.subject, '[T-Central] Quick question');
  assert.equal(draft.body, 'Topic: General question\n\nHello team!');
});

test('header-like input cannot introduce extra recipients or multiline email headers', () => {
  const draft = buildContactDraft({ subject: 'Hello\r\nBcc: other@example.com', topic: 'Help\nReply-To: other@example.com', name: 'Player\r\nBcc: other@example.com', message: 'A question' });
  assert.ok(!/[\r\n]/.test(draft.subject));
  assert.equal(new URL(draft.href).pathname, CONTACT_EMAIL);
  assert.equal(new URL(draft.href).searchParams.size, 2);
  assert.ok(draft.body.includes('Name: Player Bcc: other@example.com'));
});
