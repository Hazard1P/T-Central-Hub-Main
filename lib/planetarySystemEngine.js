function hash53(value) {
  const source = String(value || '');
  let h1 = 0xdeadbeef ^ source.length;
  let h2 = 0x41c6ce57 ^ source.length;
  for (let index = 0; index < source.length; index += 1) {
    const ch = source.charCodeAt(index);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, precision = 2) {
  return Number(Number(value).toFixed(precision));
}

const PLANET_BASELINES = [
  { name: 'Mercury', radius: 0.39, period: 0.24, size: 0.13, tilt: 7.0, eccentricity: 0.206, color: '#cfd5e2' },
  { name: 'Venus', radius: 0.72, period: 0.62, size: 0.21, tilt: 3.4, eccentricity: 0.007, color: '#ffd59e' },
  { name: 'Earth', radius: 1.0, period: 1.0, size: 0.22, tilt: 0.0, eccentricity: 0.017, color: '#89d2ff' },
  { name: 'Mars', radius: 1.52, period: 1.88, size: 0.17, tilt: 1.85, eccentricity: 0.093, color: '#ff9978' },
  { name: 'Jupiter', radius: 5.2, period: 11.86, size: 0.48, tilt: 1.3, eccentricity: 0.049, color: '#f2c994' },
  { name: 'Saturn', radius: 9.58, period: 29.46, size: 0.42, tilt: 2.49, eccentricity: 0.056, color: '#ffe3a1' },
  { name: 'Uranus', radius: 19.2, period: 84.01, size: 0.31, tilt: 0.77, eccentricity: 0.046, color: '#9ef7ff' },
  { name: 'Neptune', radius: 30.05, period: 164.8, size: 0.29, tilt: 1.77, eccentricity: 0.009, color: '#77b7ff' },
  { name: 'Pluto', radius: 39.48, period: 248.0, size: 0.12, tilt: 17.16, eccentricity: 0.249, color: '#d9c3ff' },
];

export function buildEpochPlanetarySystem({
  keyPrefix = 'central_star',
  seed = 'default',
  now = Date.now(),
  center = [0, 0, 0],
  starLabel = 'Central.Star',
  starColor = '#ffd46b',
  scope = 'private',
  ownerAlias = 'Pilot',
  foundationBuilt = true,
  privateOnly = false,
  networkMode = 'epoch-rolling',
} = {}) {
  const unixEpoch = Math.floor(Number(now) / 1000);
  const rollingWindow = Math.floor(unixEpoch / 900);
  const epochPhase = (unixEpoch % 900) / 900;
  const normalizedSeed = `${seed}:${rollingWindow}:${scope}:${ownerAlias}`;
  const starKey = `${keyPrefix}_star`;
  const starNode = {
    key: starKey,
    label: starLabel,
    address: `${scope === 'hub' ? 'Shared' : 'Private'} epoch-rolling central star`,
    description: scope === 'hub'
      ? 'Shared multiplayer reference star. It stays discrepant from player-private systems so hub synchronization has a common celestial anchor.'
      : 'Private Central.Star anchored to a rolling Unix epoch segment. It drives the player-local planetary ratios and keeps the sealed universe synchronized to the current epoch window.',
    position: center,
    color: starColor,
    kind: 'solar',
    priority: scope === 'hub' ? 8 : 11,
    foundationBuilt,
    privateOnly,
    structureProfile: scope === 'hub' ? 'shared_epoch_star' : 'private_epoch_star',
    epochUnix: unixEpoch,
    epochWindow: rollingWindow,
    epochRolling: true,
    networkMode,
    ownerAlias,
    scope,
  };

  const orbiters = PLANET_BASELINES.map((planet, index) => {
    const varianceSeed = hash53(`${normalizedSeed}:${planet.name}:${index}`);
    const radiusScale = 1 + (((varianceSeed % 2000) / 1000) - 1) * 0.035;
    const periodScale = 1 + ((((varianceSeed >> 3) % 2000) / 1000) - 1) * 0.028;
    const tiltJitter = ((((varianceSeed >> 5) % 2000) / 1000) - 1) * 0.18;
    const eccentricityJitter = ((((varianceSeed >> 7) % 2000) / 1000) - 1) * 0.02;
    const seedAngle = ((varianceSeed % 3600) / 3600) * Math.PI * 2;

    const scaledRadius = 1.38 + Math.log(planet.radius + 1) * 2.95 * radiusScale;
    const orbitalPeriod = planet.period * periodScale;
    const angularVelocity = clamp(0.88 / Math.pow(orbitalPeriod + 0.2, 0.36), 0.014, 0.82);
    const orbitTilt = ((planet.tilt * Math.PI) / 180) + tiltJitter;
    const eccentricity = clamp(planet.eccentricity + eccentricityJitter, 0, 0.32);

    return {
      key: `${keyPrefix}_planet_${index + 1}`,
      parentKey: starKey,
      label: `${planet.name} ${scope === 'hub' ? 'Hub' : 'Orbit'} ${index + 1}`,
      kind: 'planet',
      radius: round(scaledRadius),
      speed: round(angularVelocity, 4),
      size: round(planet.size * (scope === 'hub' ? 1.02 : 1)),
      tilt: round(orbitTilt, 4),
      seedAngle: round(seedAngle + epochPhase * Math.PI * 2, 4),
      eccentricity: round(eccentricity, 4),
      apoapsis: round(scaledRadius * (1 + eccentricity), 3),
      periapsis: round(scaledRadius * (1 - eccentricity), 3),
      period: round(orbitalPeriod, 3),
      massClass: index >= 4 ? 'gas' : 'rocky',
      color: planet.color,
    };
  });

  starNode.orbiters = orbiters;

  return {
    unixEpoch,
    rollingWindow,
    epochPhase: round(epochPhase, 4),
    starKey,
    starNode,
    nodes: [starNode],
    routeLinks: [],
  };
}
