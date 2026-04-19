import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptJson, signValue } from '@/lib/security';
import { createPrivacySummary } from '@/lib/universePrivacyEngine';
import { parsePrayerSeedVault, PRAYER_SEED_COOKIE, setPrayerSeedVaultCookie } from '@/lib/universeApiStore';

const MAX_SEEDS_PER_SCOPE = 40;

export async function POST(request) {
  const universeEnabled = process.env.UNIVERSE_API_ENABLED !== 'false';
  const cookieStore = cookies();

  const rawSteam = cookieStore.get('steam_session')?.value;
  let steamUser = null;

  try {
    steamUser = rawSteam ? decryptJson(rawSteam) : null;
  } catch {
    steamUser = null;
  }

  const body = await request.json().catch(() => null);
  const lobbyMode = body?.lobbyMode === 'private' ? 'private' : 'hub';
  const privacy = createPrivacySummary({ steamUser, lobbyMode });

  if (!universeEnabled) {
    return NextResponse.json({
      ok: false,
      unavailable: true,
      code: 'UNIVERSE_API_DISABLED',
      error: 'Prayer Seeds are unavailable because the universe API is disabled.',
      privacy,
    }, { status: 503 });
  }

  if (lobbyMode !== 'private') {
    return NextResponse.json({
      ok: false,
      unavailable: true,
      code: 'PRAYER_SEEDS_PRIVATE_ONLY',
      error: 'Prayer Seeds can only be planted in private world mode.',
      privacy,
    }, { status: 403 });
  }

  if (!steamUser?.steamid) {
    return NextResponse.json({
      ok: false,
      unavailable: true,
      code: 'STEAM_LOGIN_REQUIRED',
      error: 'Steam login is required to plant a private Prayer Seed.',
      privacy,
    }, { status: 401 });
  }

  const text = String(body?.body || '').trim();
  if (!text) {
    return NextResponse.json({
      ok: false,
      error: 'Prayer Seed body is required.',
    }, { status: 400 });
  }

  const vault = parsePrayerSeedVault(cookieStore.get(PRAYER_SEED_COOKIE)?.value);
  const seed = {
    id: signValue(`${steamUser.steamid}:${Date.now()}:${text}`).slice(0, 24),
    body: text.slice(0, 320),
    solarSystemKey: body?.solarSystemKey || 'solar_system',
    tags: Array.isArray(body?.tags) ? body.tags.slice(0, 8).map((tag) => String(tag).slice(0, 40)) : [],
    plantedAt: new Date().toISOString(),
    scope: privacy.storageKey,
    plantedBy: {
      steamid: steamUser.steamid,
      personaname: steamUser.personaname || null,
    },
  };

  const scopedExisting = vault.filter((entry) => entry.scope === privacy.storageKey);
  const unscoped = vault.filter((entry) => entry.scope !== privacy.storageKey);
  const scopedTrimmed = [seed, ...scopedExisting].slice(0, MAX_SEEDS_PER_SCOPE);
  const nextVault = [...unscoped, ...scopedTrimmed];

  const response = NextResponse.json({
    ok: true,
    message: 'Prayer Seed planted in your private universe vault.',
    seed,
    prayerSeeds: {
      total: scopedTrimmed.length,
      latest: scopedTrimmed.slice(0, 5),
    },
    privacy,
  });

  setPrayerSeedVaultCookie(response, nextVault);
  return response;
}
