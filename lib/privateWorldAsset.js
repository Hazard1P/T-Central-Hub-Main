import { buildEpochPlanetarySystem } from '@/lib/planetarySystemEngine';
import { getServerUniverseAnchor } from '@/lib/serverAnchor';

function hash53(value) {
  let h1 = 0xdeadbeef ^ value.length;
  let h2 = 0x41c6ce57 ^ value.length;
  for (let index = 0; index < value.length; index += 1) {
    const ch = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function digest(value) {
  const chunks = Array.from({ length: 4 }, (_, index) => hash53(`${value}:${index}`).toString(36).padStart(11, '0'));
  return chunks.join('');
}

function toNormalizedPair(seed, offset = 0) {
  const left = hash53(`${seed}:${offset}:left`) % 1000000;
  const right = hash53(`${seed}:${offset}:right`) % 1000000;
  return {
    x: (left / 500000) - 1,
    y: (right / 500000) - 1,
  };
}

export function createPrivateWorldAsset({ steamUser = null, lobbyMode = 'private', now = Date.now(), identity = null } = {}) {
  if (lobbyMode !== 'private') return null;

  const identityId = identity?.id || steamUser?.steamid || 'guest';
  const personaName = identity?.displayName || steamUser?.personaname || 'Guest Pilot';
  const unixEpoch = Math.floor(Number(now) / 1000);
  const epochWindow = Math.floor(unixEpoch / 3600);
  const anchorSeed = `${identityId}:single-player:${epochWindow}:unix-epoch-network`;
  const anchorHash = digest(anchorSeed);
  const anchorToken = anchorHash.slice(0, 18);
  const privateScope = `private:${anchorHash.slice(0, 24)}`;
  const assetKey = `private_map_asset_${anchorHash.slice(0, 10)}`;
  const blackholeKey = `${assetKey}_core`;
  const centralStarKey = `${assetKey}_central`;
  const offset = toNormalizedPair(anchorSeed, 1);
  const radius = 11.5 + Math.abs(offset.x) * 4.5;
  const theta = offset.x * Math.PI * 0.9;
  const vertical = Number((offset.y * 4.8).toFixed(2));
  const position = [
    Number((Math.cos(theta) * radius - 3.4).toFixed(2)),
    vertical,
    Number((Math.sin(theta) * radius * 0.78 + 8.2).toFixed(2)),
  ];
  const blackholePosition = [position[0], Number((position[1] - 0.18).toFixed(2)), position[2]];
  const centralStarPosition = [Number((position[0] + 4.6).toFixed(2)), Number((position[1] + 0.8).toFixed(2)), Number((position[2] - 1.2).toFixed(2))];
  const identityStatus = steamUser?.steamid ? 'steam-linked' : 'guest-fallback';
  const publicLabel = steamUser?.steamid ? 'Steam-linked private map asset' : 'Guest private map asset';
  const serverAnchor = getServerUniverseAnchor();

  const common = {
    generated: true,
    privateOnly: true,
    foundationBuilt: true,
    steamScoped: Boolean(steamUser?.steamid),
    epochUnix: unixEpoch,
    epochWindow,
    anchorToken,
    privateScope,
    serverAnchor,
    ownerAlias: personaName,
    serverAnchorHost: serverAnchor.host,
    serverAnchorToken: serverAnchor.token,
  };

  const planetarySystem = buildEpochPlanetarySystem({
    keyPrefix: centralStarKey,
    seed: anchorSeed,
    now,
    center: centralStarPosition,
    starLabel: 'Central.Star',
    starColor: '#ffd46b',
    scope: 'private',
    ownerAlias: personaName,
    foundationBuilt: true,
    privateOnly: true,
    networkMode: 'unix-epoch-rolling-private',
    serverAnchor,
  });

  return {
    steamLinked: Boolean(steamUser?.steamid),
    steamId: identityId,
    identityStatus,
    unixEpoch,
    epochWindow,
    anchorToken,
    privateScope,
    serverAnchor,
    assetKey,
    blackholeKey,
    centralStarKey: planetarySystem.starKey,
    label: publicLabel,
    description: `Singleplayer map asset with a private blackhole nested inside the local universe fabric. The anchor remains private, is keyed to a Unix-epoch network window, and is pinned to the hosting server anchor ${serverAnchor.host} whether the player is Steam-linked or using the guest fallback state.`,
    position,
    blackholePosition,
    nodes: [
      {
        ...common,
        key: assetKey,
        label: publicLabel,
        address: `Epoch anchor ${anchorToken}`,
        description: `Private singleplayer map asset. The fabric stays private to the active identity state while its internal blackhole remains nested inside the mesh instead of exposed as public infrastructure. Hosting anchor ${serverAnchor.host} keeps the system routed to its own sealed server-side universe lane.`,
        position,
        color: '#91f2ff',
        kind: 'node',
        priority: 9,
        mapAsset: true,
        mapAssetState: 'sealed-private',
        structureProfile: 'private_map_asset',
        tags: ['singleplayer', 'private map asset', 'unix epoch anchor', identityStatus],
      },
      {
        ...common,
        key: blackholeKey,
        label: 'Private Mesh Blackhole',
        address: 'Internal universe fabric core',
        description: `Nested blackhole sealed within the private map mesh. Its anchor is private, epoch-derived, server-host bound to ${serverAnchor.host}, and scoped to the active singleplayer world whether Steam-linked or guest-fallback.`,
        position: blackholePosition,
        color: '#c4d4ff',
        kind: 'blackhole',
        priority: 10,
        mapAsset: true,
        embeddedIn: assetKey,
        privateMeshCore: true,
        tags: ['private mesh', 'epoch anchor', 'sealed blackhole'],
      },
      ...planetarySystem.nodes.map((node) => ({
        ...common,
        ...node,
        priority: 8,
        privateSystem: true,
        tags: ['private planetary system', 'central star', identityStatus],
      })),
    ],
    routeLinks: [
      {
        key: `${assetKey}-mesh-core`,
        from: assetKey,
        to: blackholeKey,
        color: '#b9f7ff',
        arc: 0.72,
        weight: 1.15,
        internalOnly: true,
        playerTraversable: false,
        privateOnly: true,
      },
      {
        key: `${blackholeKey}-deep-anchor`,
        from: blackholeKey,
        to: 'deep_blackhole',
        color: '#91f2ff',
        arc: 1.35,
        weight: 0.9,
        internalOnly: true,
        playerTraversable: false,
        privateOnly: true,
      },
      {
        key: `${assetKey}-central-star`,
        from: assetKey,
        to: planetarySystem.starKey,
        color: '#ffd46b',
        arc: 0.92,
        weight: 0.74,
        internalOnly: true,
        playerTraversable: false,
        privateOnly: true,
      },
      {
        key: `${planetarySystem.starKey}-core`,
        from: planetarySystem.starKey,
        to: blackholeKey,
        color: '#ffe8aa',
        arc: 1.1,
        weight: 0.64,
        internalOnly: true,
        playerTraversable: false,
        privateOnly: true,
      },
    ],
  };
}
