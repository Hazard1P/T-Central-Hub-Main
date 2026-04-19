export const ACCOUNT_PROGRESS_VERSION = 1;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getAccountStorageKey(identityId = 'guest-server') {
  return `tcentral_account_progress_${identityId}`;
}

export function defaultProgressState() {
  return {
    visitedNodes: ['deep_blackhole'],
    routeTrips: 0,
    seedCount: 0,
    entropyMined: 0,
    entropyResolved: 0,
    credits: 0,
    multiplayerJumped: false,
  };
}

export function normalizeProgressState(input = {}, fallback = defaultProgressState()) {
  return {
    visitedNodes: Array.isArray(input.visitedNodes) && input.visitedNodes.length ? [...new Set(input.visitedNodes.map(String))] : fallback.visitedNodes,
    routeTrips: Number.isFinite(Number(input.routeTrips)) ? Number(input.routeTrips) : fallback.routeTrips,
    seedCount: Number.isFinite(Number(input.seedCount)) ? Number(input.seedCount) : fallback.seedCount,
    entropyMined: Number.isFinite(Number(input.entropyMined)) ? Number(input.entropyMined) : fallback.entropyMined,
    entropyResolved: Number.isFinite(Number(input.entropyResolved)) ? Number(input.entropyResolved) : fallback.entropyResolved,
    credits: Number.isFinite(Number(input.credits)) ? Number(input.credits) : fallback.credits,
    multiplayerJumped: typeof input.multiplayerJumped === 'boolean' ? input.multiplayerJumped : fallback.multiplayerJumped,
  };
}

export function deriveProgression(progress = defaultProgressState()) {
  const safe = normalizeProgressState(progress);
  const explorationXp = safe.visitedNodes.length * 14;
  const routingXp = safe.routeTrips * 20;
  const seedXp = safe.seedCount * 18;
  const miningXp = safe.entropyMined * 6;
  const settlementXp = safe.entropyResolved * 10;
  const scalarXp = Math.round(safe.credits * 1.8);
  const sharedHubBonus = safe.multiplayerJumped ? 44 : 0;
  const xp = explorationXp + routingXp + seedXp + miningXp + settlementXp + scalarXp + sharedHubBonus;
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 44)) + 1);
  const nextLevelXp = level * level * 44;
  const previousLevelXp = Math.max(0, (level - 1) * (level - 1) * 44);
  const progressToNext = clamp((xp - previousLevelXp) / Math.max(1, nextLevelXp - previousLevelXp), 0, 1);
  const titles = ['Cadet', 'Navigator', 'Surveyor', 'Entropic Pilot', 'Singularity Pilot', 'Epoch Captain', 'Dyson Marshal', 'Foundation Vector', 'Central Warden'];
  const title = titles[Math.min(titles.length - 1, level - 1)] || titles[titles.length - 1];
  return {
    version: ACCOUNT_PROGRESS_VERSION,
    xp,
    level,
    title,
    nextLevelXp,
    previousLevelXp,
    progressToNext,
    stats: {
      explorationXp,
      routingXp,
      seedXp,
      miningXp,
      settlementXp,
      scalarXp,
      sharedHubBonus,
    },
  };
}

export function buildAccountSnapshot({ identity = null, steamUser = null, progress = defaultProgressState(), savedAt = null } = {}) {
  const normalized = normalizeProgressState(progress);
  const progression = deriveProgression(normalized);
  return {
    version: ACCOUNT_PROGRESS_VERSION,
    identity: {
      id: String(identity?.id || steamUser?.steamid || 'guest-server'),
      displayName: identity?.displayName || steamUser?.personaname || 'Guest Pilot',
      kind: identity?.kind || (steamUser?.steamid ? 'steam' : 'guest'),
      authenticated: Boolean(identity?.authenticated || steamUser?.steamid),
    },
    progress: normalized,
    progression,
    savedAt: savedAt || new Date().toISOString(),
  };
}
