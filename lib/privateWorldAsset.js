import { buildEpochPlanetarySystem } from '@/lib/planetarySystemEngine';
import { PRIMARY_SERVER_ROUTES } from '@/lib/serverData';

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

function buildReplicaSeed(baseSeed, replicaIndex) {
  return `${baseSeed}:replica:${replicaIndex}`;
}

function buildReplicaCenter(basePosition, seed, replicaIndex) {
  const pair = toNormalizedPair(seed, replicaIndex + 3);
  const radius = 4.2 + replicaIndex * 1.15;
  return [
    Number((basePosition[0] + Math.cos(pair.x * Math.PI) * radius).toFixed(2)),
    Number((basePosition[1] + (pair.y * 1.8)).toFixed(2)),
    Number((basePosition[2] + Math.sin(pair.y * Math.PI) * radius).toFixed(2)),
  ];
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

  const common = {
    generated: true,
    privateOnly: true,
    foundationBuilt: true,
    steamScoped: Boolean(steamUser?.steamid),
    epochUnix: unixEpoch,
    epochWindow,
    anchorToken,
    privateScope,
    ownerAlias: personaName,
  };

  const replicaCount = 3;
  const planetarySystems = Array.from({ length: replicaCount }, (_, replicaIndex) => {
    const replicaSeed = buildReplicaSeed(anchorSeed, replicaIndex);
    return buildEpochPlanetarySystem({
      keyPrefix: replicaIndex === 0 ? centralStarKey : `${centralStarKey}_replica_${replicaIndex + 1}`,
      seed: replicaSeed,
      now,
      center: replicaIndex === 0 ? centralStarPosition : buildReplicaCenter(centralStarPosition, replicaSeed, replicaIndex),
      starLabel: replicaIndex === 0 ? 'Central.Star' : `Central.Star Replica ${replicaIndex + 1}`,
      starColor: replicaIndex === 0 ? '#ffd46b' : '#ffe08a',
      scope: 'private',
      ownerAlias: personaName,
      foundationBuilt: true,
      privateOnly: true,
      networkMode: 'unix-epoch-rolling-private',
    });
  });

  const primaryPlanetarySystem = planetarySystems[0];
  const associatedServerBlackholes = PRIMARY_SERVER_ROUTES.slice(0, 4).map((server, index) => {
    const pair = toNormalizedPair(`${anchorSeed}:server-blackhole:${server.slug}`, index);
    const offsetRadius = 1.9 + index * 1.15;
    const associatedPosition = [
      Number((position[0] + pair.x * offsetRadius).toFixed(2)),
      Number((position[1] + 0.6 + ((index % 2) ? -0.35 : 0.35)).toFixed(2)),
      Number((position[2] + pair.y * offsetRadius).toFixed(2)),
    ];
    return {
      ...common,
      key: `${assetKey}_server_blackhole_${index + 1}`,
      label: `${server.shortTitle} Blackhole`,
      address: server.ip,
      description: `Server-associated private blackhole anchor for ${server.shortTitle}.`,
      position: associatedPosition,
      color: index % 2 === 0 ? '#9fb7ff' : '#7fe7ff',
      kind: 'blackhole',
      priority: 9,
      mapAsset: true,
      embeddedIn: assetKey,
      privateMeshCore: true,
      associatedServer: server.slug,
      serverSlug: server.slug,
      serverHref: server.href,
      serverTitle: server.title,
      benefactor: server.accent || server.shortTitle,
      tags: ['private mesh', 'server-associated', 'benefactor anchor', server.family || server.game.toLowerCase()],
    };
  });

  return {
    steamLinked: Boolean(steamUser?.steamid),
    steamId: identityId,
    identityStatus,
    unixEpoch,
    epochWindow,
    anchorToken,
    privateScope,
    assetKey,
    blackholeKey,
    centralStarKey: primaryPlanetarySystem.starKey,
    replicaSystems: planetarySystems.map((system, index) => ({
      index,
      starKey: system.starKey,
      starLabel: system.nodes?.[0]?.label || `Replica ${index + 1}`,
    })),
    serverBlackholeKeys: associatedServerBlackholes.map((node) => node.key),
    label: publicLabel,
    description: 'Singleplayer map asset with independent epoch-rolling solar replicas, one central-star core, and four server-associated private blackholes nested inside the local universe fabric.',
    position,
    blackholePosition,
    nodes: [
      {
        ...common,
        key: assetKey,
        label: publicLabel,
        address: `Epoch anchor ${anchorToken}`,
        description: 'Private singleplayer map asset. The fabric stays private to the active identity state while its internal blackhole remains nested inside the mesh instead of exposed as public infrastructure.',
        position,
        color: '#91f2ff',
        kind: 'node',
        priority: 9,
        mapAsset: true,
        mapAssetState: 'sealed-private',
        structureProfile: 'private_map_asset',
        tags: ['singleplayer', 'private map asset', 'unix epoch anchor', identityStatus, 'epoch replica lattice'],
      },
      {
        ...common,
        key: blackholeKey,
        label: 'Private Mesh Blackhole',
        address: 'Internal universe fabric core',
        description: 'Nested blackhole sealed within the private map mesh. Its anchor is private, epoch-derived, and scoped to the active singleplayer world whether Steam-linked or guest-fallback.',
        position: blackholePosition,
        color: '#c4d4ff',
        kind: 'blackhole',
        priority: 10,
        mapAsset: true,
        embeddedIn: assetKey,
        privateMeshCore: true,
        tags: ['private mesh', 'epoch anchor', 'sealed blackhole', 'central mesh core'],
      },
      ...associatedServerBlackholes,
      ...planetarySystems.flatMap((system, replicaIndex) => system.nodes.map((node) => ({
        ...common,
        ...node,
        priority: 8,
        privateSystem: true,
        replicaIndex,
        tags: ['private planetary system', 'central star', identityStatus, replicaIndex === 0 ? 'primary epoch system' : 'solar replica system'],
      }))),
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
        to: primaryPlanetarySystem.starKey,
        color: '#ffd46b',
        arc: 0.92,
        weight: 0.74,
        internalOnly: true,
        playerTraversable: false,
        privateOnly: true,
      },
      {
        key: `${primaryPlanetarySystem.starKey}-core`,
        from: primaryPlanetarySystem.starKey,
        to: blackholeKey,
        color: '#ffe8aa',
        arc: 1.1,
        weight: 0.64,
        internalOnly: true,
        playerTraversable: false,
        privateOnly: true,
      },
      ...associatedServerBlackholes.map((node, index) => ({
        key: `${node.key}-mesh-link`,
        from: node.key,
        to: blackholeKey,
        color: index % 2 === 0 ? '#9fb7ff' : '#8fefff',
        arc: 0.94 + index * 0.12,
        weight: 0.72,
        internalOnly: true,
        playerTraversable: false,
        privateOnly: true,
      })),
      ...planetarySystems
        .slice(1)
        .map((system, index) => ({
          key: `${system.starKey}-to-primary-core`,
          from: system.starKey,
          to: primaryPlanetarySystem.starKey,
          color: '#ffdfa4',
          arc: 1.18 + index * 0.16,
          weight: 0.66,
          internalOnly: true,
          playerTraversable: false,
          privateOnly: true,
        })),
    ],
  };
}
