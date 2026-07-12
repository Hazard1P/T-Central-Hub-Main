import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPrivacySummary, createUniverseScope } from '../lib/universePrivacyEngine.js';

function buildSessionResponsePrivacy(authContext, lobbyMode = 'hub') {
  return {
    ok: true,
    authenticated: authContext.authenticated,
    authContext: {
      authenticated: authContext.authenticated,
      provider: authContext.provider,
      accountId: authContext.accountId,
      displayName: authContext.displayName,
      identityKind: authContext.identityKind,
    },
    lobbyMode,
    privacy: createPrivacySummary({ authContext, lobbyMode }),
  };
}

test('universe session response keeps unauthenticated guests on guest privacy storage', () => {
  const response = buildSessionResponsePrivacy({
    authenticated: false,
    provider: null,
    accountId: null,
    displayName: null,
    identityKind: null,
  });

  assert.equal(response.authenticated, false);
  assert.equal(response.authContext.provider, null);
  assert.equal(response.privacy.identity, 'guest');
  assert.equal(response.privacy.privateScope, 'private:guest');
  assert.equal(response.privacy.storageKey, 'vault:private:guest');
  assert.equal(response.privacy.playerKey, 'guest-observer');
  assert.equal(response.privacy.supportsPrivateUniverse, false);
});

test('universe session response preserves existing Steam privacy scopes and keys', () => {
  const authContext = {
    authenticated: true,
    provider: 'steam',
    accountId: '76561198000000000',
    displayName: 'Steam Pilot',
    identityKind: 'steam',
    steamUser: { steamid: '76561198000000000', personaname: 'Steam Pilot' },
  };
  const response = buildSessionResponsePrivacy(authContext, 'private');
  const legacyScope = createUniverseScope({ steamId: authContext.steamUser.steamid, lobbyMode: 'private' });
  const legacyPrivacy = createPrivacySummary({ steamUser: authContext.steamUser, lobbyMode: 'private' });

  assert.equal(response.authContext.provider, 'steam');
  assert.equal(response.privacy.identity, legacyScope.identity);
  assert.equal(response.privacy.privateScope, legacyScope.privateScope);
  assert.equal(response.privacy.publicScope, legacyScope.publicScope);
  assert.equal(response.privacy.observanceScope, legacyScope.observanceScope);
  assert.equal(response.privacy.storageKey, legacyScope.storageKey);
  assert.equal(response.privacy.playerKey, legacyPrivacy.playerKey);
  assert.equal(response.privacy.supportsPrivateUniverse, true);
});

test('universe session response gives Google users stable authenticated privacy storage based on google:sub', () => {
  const authContext = {
    authenticated: true,
    provider: 'google',
    accountId: 'google-sub-123',
    displayName: 'Google Pilot',
    identityKind: 'google',
    googleUser: { sub: 'google-sub-123', name: 'Google Pilot' },
  };
  const response = buildSessionResponsePrivacy(authContext, 'private');
  const repeat = createPrivacySummary({
    provider: 'google',
    accountId: 'google-sub-123',
    displayName: 'Google Pilot',
    authenticated: true,
    lobbyMode: 'private',
  });
  const differentGoogle = createPrivacySummary({
    provider: 'google',
    accountId: 'google-sub-456',
    authenticated: true,
    lobbyMode: 'private',
  });

  assert.equal(response.authContext.provider, 'google');
  assert.equal(response.privacy.identity, 'google:google-sub-123');
  assert.equal(response.privacy.storageKey, repeat.storageKey);
  assert.equal(response.privacy.privateScope, repeat.privateScope);
  assert.equal(response.privacy.playerKey, repeat.playerKey);
  assert.notEqual(response.privacy.storageKey, differentGoogle.storageKey);
  assert.equal(response.privacy.supportsPrivateUniverse, true);
});

test('universe session route passes the full auth context into the privacy summary', () => {
  const routeSource = readFileSync(new URL('../app/api/universe/session/route.js', import.meta.url), 'utf8');

  assert.match(routeSource, /createPrivacySummary\(\{ authContext, lobbyMode \}\)/);
  assert.doesNotMatch(routeSource, /createPrivacySummary\(\{ steamUser: authContext\.steamUser, lobbyMode \}\)/);
});
