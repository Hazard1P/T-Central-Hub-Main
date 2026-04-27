import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { summarizeEpochRelativity } from '@/lib/epochDysonEngine';
import { computeCsisDysonState, summarizeCsisDysonState } from '@/lib/csisDysonSphereEngine';
import { createPrivacySummary } from '@/lib/universePrivacyEngine';
import { summarizePrayerSeeds } from '@/lib/prayerSeedEngine';
import { readDonationLedger, summarizeDonationLedger } from '@/lib/donationLedger';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';
import { trackServerEvent } from '@/lib/server/vercelTelemetry';
import { runLaunchGenesisPipeline } from '@/lib/launch/launchGenesisPipeline';
import { persistLaunchRecord } from '@/lib/serverPersistence';

export const dynamic = 'force-dynamic';

function resolveLobbyMode(value) {
  return value === 'private' ? 'private' : 'hub';
}

export async function GET(request) {
  const cookieStore = cookies();
  const authContext = resolveGameAuthContext(cookieStore);

  const { searchParams } = new URL(request.url);
  const lobbyMode = resolveLobbyMode(searchParams.get('lobbyMode'));

  const launchGenesis = runLaunchGenesisPipeline({ authContext, lobbyMode });

  if (!launchGenesis.ok) {
    await trackServerEvent('api_universe_launch_prereq_blocked', {
      lobbyMode,
      accountId: authContext.accountId || 'guest-server',
      failedStage: launchGenesis.failedStage || 'unknown',
      reason: launchGenesis.reason || 'PREREQUISITE_FAILED',
    });

    return NextResponse.json(
      {
        ok: false,
        blocked: true,
        reason: launchGenesis.reason || 'LAUNCH_PREREQUISITE_FAILED',
        failedStage: launchGenesis.failedStage || 'unknown',
      },
      { status: 412 },
    );
  }

  const persistence = await persistLaunchRecord(launchGenesis.launchRecord);

  const privacy = createPrivacySummary({ steamUser: authContext.steamUser, lobbyMode });
  const epochAnchor = launchGenesis.epoch;
  const sessionMode = lobbyMode === 'hub' ? 'multiplayer' : 'singleplayer';
  const csisDysonState = computeCsisDysonState({
    epoch: epochAnchor,
    authContext: {
      authenticated: authContext.authenticated,
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

  const dysonRings = summarizeCsisDysonState(csisDysonState);
  const donations = summarizeDonationLedger(readDonationLedger());

  await trackServerEvent('api_universe_session', {
    lobbyMode,
    authenticated: authContext.authenticated,
    provider: authContext.provider || 'guest',
    launchPersistence: persistence.storage || 'none',
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
    dysonRings,
    prayerSeeds: summarizePrayerSeeds([], 'solar_system'),
    donations,
    ring1Metering: dysonRings.ring1,
    launchRecord: launchGenesis.launchRecord,
    launchPersistence: persistence,
    generatedAt: new Date().toISOString(),
  });
}
