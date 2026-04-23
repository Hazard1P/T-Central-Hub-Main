import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptJson } from '@/lib/security';
import { createEpochAnchor, summarizeEpochRelativity } from '@/lib/epochDysonEngine';
import { computeCsisDysonState, summarizeCsisDysonState } from '@/lib/csisDysonSphereEngine';
import { createPrivacySummary } from '@/lib/universePrivacyEngine';
import { summarizePrayerSeeds } from '@/lib/prayerSeedEngine';
import { readDonationLedger, summarizeDonationLedger } from '@/lib/donationLedger';

function resolveLobbyMode(value) {
  return value === 'private' ? 'private' : 'hub';
}

function readSteamUser(cookieStore) {
  const rawSteamSession = cookieStore.get('steam_session')?.value;

  try {
    const user = rawSteamSession ? decryptJson(rawSteamSession) : null;
    return user && typeof user === 'object' ? user : null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  const cookieStore = cookies();
  const steamUser = readSteamUser(cookieStore);

  const { searchParams } = new URL(request.url);
  const lobbyMode = resolveLobbyMode(searchParams.get('lobbyMode'));

  const privacy = createPrivacySummary({ steamUser, lobbyMode });
  const epochAnchor = createEpochAnchor();
  const sessionMode = lobbyMode === 'hub' ? 'multiplayer' : 'singleplayer';
  const csisDysonState = computeCsisDysonState({
    epoch: epochAnchor,
    authContext: {
      authenticated: Boolean(steamUser?.steamid),
    },
    sessionContext: {
      mode: sessionMode,
    },
    telemetry: {
      meterTick: epochAnchor.unix,
      previousMeterTick: epochAnchor.unix - 30,
      discrepancyDelta: Math.abs((epochAnchor.dysonAlignment || 0) - (epochAnchor.siderealDrift || 0)),
      styleSignal: epochAnchor.phase || 0,
    },
  });

  return NextResponse.json({
    ok: true,
    authenticated: Boolean(steamUser?.steamid),
    lobbyMode,
    privacy,
    epoch: summarizeEpochRelativity(epochAnchor),
    dysonRings: summarizeCsisDysonState(csisDysonState),
    prayerSeeds: summarizePrayerSeeds([], 'solar_system'),
    donations: summarizeDonationLedger(readDonationLedger()),
    generatedAt: new Date().toISOString(),
  });
}
