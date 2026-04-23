import { DEFAULT_PRESENCE_SIGNATURE, normalizeHyperspaceSignature } from '@/lib/simulationConfig';
const GUEST_KEY = 'tcentral_guest_multiplayer_identity';

function createGuestIdentity() {
  const epochShard = Math.floor(Date.now() / (1000 * 60 * 15)).toString(36);
  const entropy = Math.random().toString(36).slice(2, 10);
  return {
    id: `guest-${epochShard}-${entropy}`,
    displayName: `Guest Pilot ${entropy.slice(-3).toUpperCase()}`,
  };
}

export function resolveMultiplayerIdentity(steamUser = null) {
  if (steamUser?.steamid) {
    return {
      id: String(steamUser.steamid),
      displayName: steamUser.personaname || 'Steam Pilot',
      authenticated: true,
      kind: 'steam',
    };
  }

  if (typeof window === 'undefined') {
    return { id: 'guest-server', displayName: 'Guest Pilot', authenticated: false, kind: 'guest' };
  }

  try {
    const existing = window.localStorage.getItem(GUEST_KEY);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed?.id) return { ...parsed, authenticated: false, kind: 'guest' };
    }
  } catch {}

  const created = createGuestIdentity();
  try {
    window.localStorage.setItem(GUEST_KEY, JSON.stringify(created));
  } catch {}
  return { ...created, authenticated: false, kind: 'guest' };
}

export function createPresenceSnapshot({ steamUser = null, telemetry = null, scope = null, lobbyMode = 'hub' } = {}) {
  const identity = resolveMultiplayerIdentity(steamUser);
  return {
    id: identity.id,
    displayName: identity.displayName,
    lobbyMode,
    observanceScope: scope?.observanceScope || 'hub:public',
    authenticated: identity.authenticated,
    identityKind: identity.kind,
    speed: Number(telemetry?.speed || 0),
    nearest: telemetry?.nearest || null,
    quantumSignature: normalizeHyperspaceSignature(telemetry?.quantum?.signature, DEFAULT_PRESENCE_SIGNATURE),
    position: Array.isArray(telemetry?.position) ? telemetry.position.slice(0, 3).map((value) => Number(value || 0)) : [0, 0, 0],
    velocity: Array.isArray(telemetry?.velocity) ? telemetry.velocity.slice(0, 3).map((value) => Number(value || 0)) : [0, 0, 0],
    direction: Array.isArray(telemetry?.direction) ? telemetry.direction.slice(0, 3).map((value) => Number(value || 0)) : [0, 0, -1],
    firing: Boolean(telemetry?.firing),
    updatedAt: new Date().toISOString(),
  };
}

export function reducePresenceSnapshots(snapshots = [], maxCount = 24) {
  const deduped = new Map();
  snapshots.forEach((snapshot) => {
    if (!snapshot?.id) return;
    deduped.set(snapshot.id, snapshot);
  });
  return [...deduped.values()]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, maxCount);
}

export function broadcastLocalPresence(snapshot) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('tcentral_presence_sync', JSON.stringify(snapshot));
  } catch {}
  window.dispatchEvent(new CustomEvent('tcentral-presence-updated', { detail: snapshot }));
}
