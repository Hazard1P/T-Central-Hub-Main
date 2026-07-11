import { PRIMARY_SERVER_ROUTES, getServerBySlug } from '@/lib/serverData';
import { SECURITY_CONFIG } from '@/lib/securityConfig';
import { signValue } from '@/lib/security';
import { createRealLifeGameDayAnchor } from '@/lib/epochDysonEngine';

export const PLAYABLE_SECTION_VERSION = '2026.07.11-five-day-anchor-playable';

const DEFAULT_ALLOWED_CLIENTS = Object.freeze(['desktop', 'steam', 'vr']);

function uniqueStrings(values = []) {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())));
}

function buildServerAllowance(server) {
  const isArma = server.family === 'arma' || server.slug === 'arma3-cth';
  const isRust = server.family === 'rust';
  const allow = uniqueStrings([
    'steam_quick_connect',
    'encrypted_session_handoff',
    'continuity_checkpoint_restore',
    isArma ? 'human_avatar_spawn' : null,
    isArma ? 'human_entity_replication' : null,
    isArma ? 'vr_observer_bridge' : null,
    isRust ? 'survival_server_handoff' : null,
  ]);

  return {
    id: server.id,
    slug: server.slug,
    title: server.title,
    ip: server.ip,
    game: server.game,
    map: server.map,
    href: server.href,
    steamAppId: server.steamAppId,
    allowedClients: DEFAULT_ALLOWED_CLIENTS,
    allow,
    deny: ['raw_private_asset_export', 'unauthenticated_admin_mutation', 'server_secret_disclosure'],
    playableSurface: isArma ? 'arma-human-avatar-vr' : 'steam-server-route',
    avatarRuntime: isArma
      ? {
          enabled: true,
          species: 'human',
          entityClasses: ['player_avatar', 'human_entity', 'vr_observer_avatar'],
          replication: 'authoritative-server-with-encrypted-hub-checkpoint',
          spawnPolicy: 'server-verified-team-entry',
        }
      : {
          enabled: false,
          reason: 'Server route does not advertise human-avatar bridge support.',
        },
  };
}

export function getPlayableSectionPolicy({ selectedSlug = null, identityScope = 'guest', now = Date.now(), playableAt = now } = {}) {
  const realLifeGameDay = createRealLifeGameDayAnchor({ now, playableAt });
  const servers = PRIMARY_SERVER_ROUTES.map(buildServerAllowance);
  const selectedServer = selectedSlug ? getServerBySlug(selectedSlug) : null;
  const selected = selectedServer ? buildServerAllowance(selectedServer) : servers.find((server) => server.slug === 'arma3-cth');
  const checkpointScope = selected?.slug ? `checkpoint:${selected.slug}:${identityScope}` : `checkpoint:hub:${identityScope}`;
  const signedAt = new Date().toISOString();
  const signedPayload = {
    version: PLAYABLE_SECTION_VERSION,
    selectedSlug: selected?.slug || null,
    identityScope,
    checkpointScope,
    signedAt,
    realLifeGameDayScope: realLifeGameDay.multiplayerScope,
  };

  return {
    version: PLAYABLE_SECTION_VERSION,
    selected,
    servers,
    checkpoint: {
      scope: checkpointScope,
      mode: 'continuity-gated',
      restoreOrder: ['memory', 'localSnapshotFile', 'serverAuthoritativeState'],
      checkpointTypes: ['dyson-ring-integrity', 'private-map-anchor', 'playable-avatar-state', 'server-route-allowance', 'five-day-real-life-anchor'],
    },
    encryption: {
      transport: SECURITY_CONFIG.transport,
      payload: SECURITY_CONFIG.encryption,
      sessionSignature: 'HMAC-SHA512 signed playable section policy',
      standards: SECURITY_CONFIG.standards,
      signedAt,
      signature: process.env.SESSION_SECRET
        ? signValue(JSON.stringify(signedPayload))
        : 'runtime-secret-required',
    },
    realLifeGameDay,
    mapAnchor: {
      source: 'privateWorldAsset',
      playable: true,
      targetServerSlug: selected?.slug || 'arma3-cth',
      avatarBridge: selected?.avatarRuntime || null,
      vrReady: Boolean(selected?.allow?.includes('vr_observer_bridge')),
    },
  };
}
