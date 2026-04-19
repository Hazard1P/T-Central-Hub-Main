import crypto from 'crypto';

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest('base64url');
}

export function createUniverseScope({ steamId = null, roomName = 'tcentral-main', lobbyMode = 'hub' } = {}) {
  const identity = steamId ? `steam:${steamId}` : 'guest';
  const privateScope = steamId ? `private:${digest(`${roomName}:${identity}`).slice(0, 24)}` : 'private:guest';
  const publicScope = `hub:${digest(roomName).slice(0, 16)}`;
  const observanceScope = lobbyMode === 'private' ? privateScope : publicScope;

  return {
    roomName,
    identity,
    privateScope,
    publicScope,
    observanceScope,
    lobbyMode,
    isPrivate: lobbyMode === 'private' && Boolean(steamId),
    privacyTier: steamId ? (lobbyMode === 'private' ? 'private-linked' : 'linked-public') : 'guest-public',
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
    quantumSignature: source.quantum?.signature || 'Q12D-0-0',
    updatedAt: new Date().toISOString(),
  };
}

export function createPrivacySummary({ steamUser = null, lobbyMode = 'hub', roomName = 'tcentral-main' } = {}) {
  const scope = createUniverseScope({ steamId: steamUser?.steamid || null, roomName, lobbyMode });
  return {
    ...scope,
    playerKey: steamUser?.steamid ? digest(`player:${steamUser.steamid}`).slice(0, 18) : 'guest-observer',
    supportsPrivateUniverse: Boolean(steamUser?.steamid),
  };
}
