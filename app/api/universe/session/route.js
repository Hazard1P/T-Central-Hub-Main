import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptJson } from '@/lib/security';
import { createEpochAnchor, summarizeEpochRelativity } from '@/lib/epochDysonEngine';
import { createPrivacySummary } from '@/lib/universePrivacyEngine';
import { summarizePrayerSeeds } from '@/lib/prayerSeedEngine';
import { readDonationLedger, summarizeDonationLedger } from '@/lib/donationLedger';
import { runRing1Reconciliation } from '@/lib/integrations/synapticsSecondsMeterAdapter';

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

function buildGameplaySignals({ donations = {}, steamUser, lobbyMode }) {
  const donorCount = Array.isArray(donations?.entries) ? donations.entries.length : 0;
  const donationTotal = Number(donations?.totalUsd || 0);

  return {
    playerCount: steamUser?.steamid ? 2 : 1,
    framePressure: lobbyMode === 'private' ? 0.22 : 0.3,
    conflictLoad: Math.min(1.2, (donorCount * 0.02) + (donationTotal > 100 ? 0.16 : 0.06)),
  };
}

function buildDegradedRing1Status(reason = 'RING1_RECONCILIATION_UNAVAILABLE') {
  return {
    ok: false,
    degraded: true,
    reason,
    snapshot: {
      source: 'fallback',
      meterTick: Date.now(),
      observedEntropy: 0,
      secondsFlux: 0,
      confidence: 0.35,
    },
    discrepancy: {
      expectedEntropy: 0,
      discrepancy: 0,
      entropyBudget: 0,
      severity: 'low',
      signals: {
        framePressure: 0.2,
        conflictLoad: 0.1,
        playerCount: 1,
      },
    },
    distribution: {
      storage: 0,
      dispersal: 0,
      generation: 0,
    },
    persistence: {
      ok: false,
      storage: 'none',
    },
  };
}

export async function GET(request) {
  const cookieStore = cookies();
  const steamUser = readSteamUser(cookieStore);

  const { searchParams } = new URL(request.url);
  const lobbyMode = resolveLobbyMode(searchParams.get('lobbyMode'));

  const privacy = createPrivacySummary({ steamUser, lobbyMode });
  const epochAnchor = createEpochAnchor();
  const donations = summarizeDonationLedger(readDonationLedger());

  let ring1Metering = buildDegradedRing1Status('RING1_RECONCILIATION_NOT_RUN');

  try {
    ring1Metering = await runRing1Reconciliation({
      sessionContext: {
        sessionId: String(steamUser?.steamid || 'guest-session'),
        lobbyMode,
      },
      gameplaySignals: buildGameplaySignals({ donations, steamUser, lobbyMode }),
    });
  } catch (error) {
    ring1Metering = buildDegradedRing1Status(error?.message || 'RING1_RECONCILIATION_FAILED');
  }

  return NextResponse.json({
    ok: true,
    authenticated: Boolean(steamUser?.steamid),
    lobbyMode,
    privacy,
    epoch: summarizeEpochRelativity(epochAnchor),
    prayerSeeds: summarizePrayerSeeds([], 'solar_system'),
    donations,
    ring1Metering,
    generatedAt: new Date().toISOString(),
  });
}
