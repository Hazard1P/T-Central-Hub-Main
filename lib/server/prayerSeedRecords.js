import { createHash, randomUUID } from 'node:crypto';
import { createEpochAnchor } from '../epochDysonEngine.js';
import { isNearPrayerRelic, PRAYER_SEED_MAX_LENGTH } from '../prayerSeedDiscovery.js';

export class PrayerSeedError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function getSeedOwner(auth) {
  if (!auth?.authenticated || !['steam', 'google'].includes(auth.provider) || !auth.accountId) {
    throw new PrayerSeedError('Sign in with Steam or Google to keep this seed.', 401);
  }
  return `${auth.provider}:${auth.accountId}`;
}

export function validateSeedInput(input) {
  if (typeof input?.body !== 'string' || !input.body.trim() || input.body.trim().length > PRAYER_SEED_MAX_LENGTH) {
    throw new PrayerSeedError(`Write between 1 and ${PRAYER_SEED_MAX_LENGTH} characters for your seed.`);
  }
  if (typeof input.requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(input.requestId)) {
    throw new PrayerSeedError('A valid discovery request is required.');
  }
  if (!isNearPrayerRelic(input.position)) throw new PrayerSeedError('Approach the quiet signal to leave a seed.');
  if (typeof input.flightSignature !== 'string' || !/^[a-zA-Z0-9:._-]{1,80}$/.test(input.flightSignature)) {
    throw new PrayerSeedError('A flight signature is required.');
  }
  return { body: input.body.trim(), requestId: input.requestId, flightSignature: input.flightSignature };
}

export function createCyberIntelligence(auth, now = Date.now()) {
  return {
    id: randomUUID(), account_key: getSeedOwner(auth), provider: auth.provider, account_id: String(auth.accountId),
    created_at: new Date(now).toISOString(), epoch_unix: Math.floor(now / 1000),
    protocol: 'synaptics-cyberseed-v1', sequence: ['LUX', 'VIBRA', 'MTR', 'AEON', 'KYR', 'OMNI', '∆Ψ'],
  };
}

export function createBoundPrayerSeed(auth, profile, input, now = Date.now()) {
  const owner = getSeedOwner(auth);
  if (owner !== profile.account_key) throw new PrayerSeedError('This intelligence belongs to another account.', 403);
  const epoch = createEpochAnchor({ now });
  const record = {
    id: randomUUID(), account_key: owner, cyber_intelligence_id: profile.id, request_id: input.requestId,
    body: input.body, flight_signature: input.flightSignature,
    created_at: new Date(now).toISOString(), epoch_unix: epoch.unix, epoch_anchor: epoch,
    kind: 'In-Prayer-Intelligence', origin: 'halcyon-quiet-signal',
  };
  // A content binding, not an authentication credential. Ownership comes from verified cookies.
  record.binding_hash = createHash('sha256').update(JSON.stringify([
    'in-prayer-intelligence-v1', owner, profile.id, record.id, record.epoch_unix,
    record.body, record.flight_signature,
  ])).digest('hex');
  return record;
}
