import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createEpochAnchor, summarizeEpochRelativity } from '@/lib/epochDysonEngine';
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
    prayerSeeds: summarizePrayerSeeds([], 'solar_system'),
    donations: summarizeDonationLedger(readDonationLedger()),
    generatedAt: new Date().toISOString(),
  });
}
export const dynamic = 'force-dynamic';
