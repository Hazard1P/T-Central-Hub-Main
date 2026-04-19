const MAX_PRAYER_SEEDS = 144;
const MAX_BODY_LENGTH = 280;

export function normalizePrayerSeed(input, { scope, solarSystemKey = 'solar_system', epochAnchor = null } = {}) {
  const body = String(input?.body || '').trim().slice(0, MAX_BODY_LENGTH);
  if (!body) return null;

  return {
    id: input?.id || `seed_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    body,
    solarSystemKey,
    scope: scope?.privateScope || 'private:guest',
    createdAt: input?.createdAt || new Date().toISOString(),
    createdAtUnix: Number(input?.createdAtUnix || Math.floor(Date.now() / 1000)),
    epochAnchor: epochAnchor ? {
      unix: Number(epochAnchor.unix),
      phase: Number(epochAnchor.phase),
      dysonAlignment: Number(epochAnchor.dysonAlignment),
    } : null,
    tags: Array.isArray(input?.tags) ? input.tags.slice(0, 8).map((tag) => String(tag).slice(0, 32)) : [],
    visibility: 'private',
  };
}

export function sortPrayerSeeds(seeds = []) {
  return [...seeds].sort((a, b) => Number(b.createdAtUnix || 0) - Number(a.createdAtUnix || 0));
}

export function mergePrayerSeed(seed, seeds = []) {
  const normalized = normalizePrayerSeed(seed);
  if (!normalized) return sortPrayerSeeds(seeds).slice(0, MAX_PRAYER_SEEDS);
  const next = [normalized, ...seeds.filter((item) => item?.id !== normalized.id)];
  return sortPrayerSeeds(next).slice(0, MAX_PRAYER_SEEDS);
}

export function filterPrayerSeedsBySolarSystem(seeds = [], solarSystemKey = 'solar_system') {
  return sortPrayerSeeds(seeds).filter((seed) => seed?.solarSystemKey === solarSystemKey);
}

export function summarizePrayerSeeds(seeds = [], solarSystemKey = 'solar_system') {
  const scoped = filterPrayerSeedsBySolarSystem(seeds, solarSystemKey);
  const latest = scoped[0] || null;
  return {
    total: scoped.length,
    latestBody: latest?.body || null,
    latestCreatedAt: latest?.createdAt || null,
  };
}
