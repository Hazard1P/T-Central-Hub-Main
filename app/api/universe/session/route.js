import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createEpochAnchor, summarizeEpochRelativity } from '@/lib/epochDysonEngine';
import { computeCsisDysonState, summarizeCsisDysonState } from '@/lib/csisDysonSphereEngine';
import { createPrivacySummary } from '@/lib/universePrivacyEngine';
import { summarizePrayerSeeds } from '@/lib/prayerSeedEngine';
import { readDonationLedger, summarizeDonationLedger } from '@/lib/donationLedger';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';

function resolveLobbyMode(value) {
  return value === 'private' ? 'private' : 'hub';
}

export async function GET(request) {
  const cookieStore = cookies();
  const authContext = resolveGameAuthContext(cookieStore);

  const { searchParams } = new URL(request.url);
  const lobbyMode = resolveLobbyMode(searchParams.get('lobbyMode'));

  const privacy = createPrivacySummary({ steamUser: authContext.steamUser, lobbyMode });
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
    authenticated: authContext.authenticated,
    authContext: {
      authenticated: authContext.authenticated,
      provider: authContext.provider,
      accountId: authContext.accountId,
      displayName: authContext.displayName,
      identityKind: authContext.identityKind,
    },
    lobbyMode,
    privacy,
    epoch: summarizeEpochRelativity(epochAnchor),
    dysonRings: summarizeCsisDysonState(csisDysonState),
    prayerSeeds: summarizePrayerSeeds([], 'solar_system'),
    donations,
    ring1Metering,
    generatedAt: new Date().toISOString(),
  });
}
export const dynamic = 'force-dynamic';
