import crypto from 'crypto';
import { DEFAULT_PRESENCE_SIGNATURE, normalizeHyperspaceSignature } from './simulationConfig.js';

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest('base64url');
}

export function createUniverseScope({ steamId = null, accountIdentity = null, roomName = 'tcentral-main', lobbyMode = 'hub' } = {}) {
  const identity = steamId ? `steam:${steamId}` : (accountIdentity || 'guest');
  const authenticated = identity !== 'guest';
  const privateScope = authenticated ? `private:${digest(`${roomName}:${identity}`).slice(0, 24)}` : 'private:guest';
  const publicScope = `hub:${digest(roomName).slice(0, 16)}`;
  const observanceScope = lobbyMode === 'private' ? privateScope : publicScope;

  return {
    roomName,
    identity,
    privateScope,
    publicScope,
    observanceScope,
    lobbyMode,
    isPrivate: lobbyMode === 'private' && authenticated,
    privacyTier: authenticated ? (lobbyMode === 'private' ? 'private-linked' : 'linked-public') : 'guest-public',
    storageKey: `vault:${privateScope}`,
    multiplayerChannel: `mp:${publicScope}`,
  };
}

export function sanitizePresenceEnvelope({ steamUser = null, telemetry = null, scope }) {
  const safeName = steamUser?.personaname || 'Guest Pilot';
  const source = telemetry || {};
  return {
    scope: scope?.publicScope || 'hub:public',
    displayName: safeName,
    authenticated: Boolean(steamUser?.steamid),
    speed: Number(source.speed || 0),
    nearest: source.nearest || null,
    horizonFactor: Number(source.horizonFactor || 0),
    quantumSignature: normalizeHyperspaceSignature(source.quantum?.signature, DEFAULT_PRESENCE_SIGNATURE),
    updatedAt: new Date().toISOString(),
  };
}

function resolvePrivacyIdentity({ steamUser = null, authContext = null, provider = null, accountId = null, displayName = null, authenticated = null } = {}) {
  const context = authContext || { provider, accountId, displayName, authenticated };
  const steamId = steamUser?.steamid || (context?.provider === 'steam' && context?.accountId ? String(context.accountId) : null);

  if (steamId) {
    return {
      steamId,
      accountIdentity: `steam:${steamId}`,
      playerIdentity: steamId,
      authenticated: true,
    };
  }

  if (context?.authenticated && context?.provider && context?.accountId) {
    const normalizedProvider = String(context.provider).toLowerCase();
    const normalizedAccountId = String(context.accountId);
    const accountIdentity = `${normalizedProvider}:${normalizedAccountId}`;
    return {
      steamId: null,
      accountIdentity,
      playerIdentity: accountIdentity,
      authenticated: true,
    };
  }

  return {
    steamId: null,
    accountIdentity: null,
    playerIdentity: null,
    authenticated: false,
  };
}

export function createPrivacySummary({ steamUser = null, authContext = null, provider = null, accountId = null, displayName = null, authenticated = null, lobbyMode = 'hub', roomName = 'tcentral-main' } = {}) {
  const identity = resolvePrivacyIdentity({ steamUser, authContext, provider, accountId, displayName, authenticated });
  const scope = createUniverseScope({ steamId: identity.steamId, accountIdentity: identity.accountIdentity, roomName, lobbyMode });
  return {
    ...scope,
    playerKey: identity.playerIdentity ? digest(`player:${identity.playerIdentity}`).slice(0, 18) : 'guest-observer',
    supportsPrivateUniverse: identity.authenticated,
  };
}
