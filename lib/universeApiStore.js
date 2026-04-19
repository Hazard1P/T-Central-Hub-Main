import { decryptJson, encryptJson } from '@/lib/security';

export const PRAYER_SEED_COOKIE = 'universe_prayer_seeds';

export function parsePrayerSeedVault(rawValue) {
  if (!rawValue) return [];

  try {
    const parsed = decryptJson(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry === 'object' && typeof entry.scope === 'string');
  } catch {
    return [];
  }
}

export function setPrayerSeedVaultCookie(response, seeds) {
  response.cookies.set({
    name: PRAYER_SEED_COOKIE,
    value: encryptJson(seeds),
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  });
}
