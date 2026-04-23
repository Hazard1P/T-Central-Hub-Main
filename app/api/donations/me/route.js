import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptJson } from '@/lib/security';
import { readDonationLedger, summarizeDonationLedger } from '@/lib/donationLedger';
import { getDonationsBySteamId } from '@/lib/server/donationStore';

function readSteamSession() {
  const cookieStore = cookies();
  const rawSteam = cookieStore.get('steam_session')?.value;
  try {
    return rawSteam ? decryptJson(rawSteam) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const steamUser = readSteamSession();

  if (!steamUser?.steamid) {
    return NextResponse.json({ ok: true, summary: summarizeDonationLedger([]), cacheSummary: summarizeDonationLedger([]) });
  }

  try {
    const { summary, ledger } = await getDonationsBySteamId(steamUser.steamid);
    const cacheLedger = readDonationLedger().filter((entry) => entry?.steamid === steamUser.steamid);

    return NextResponse.json({
      ok: true,
      summary,
      cacheSummary: summarizeDonationLedger(cacheLedger),
      donations: ledger,
    });
  } catch (error) {
    const cacheLedger = readDonationLedger().filter((entry) => entry?.steamid === steamUser.steamid);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unable to load donations',
        summary: summarizeDonationLedger([]),
        cacheSummary: summarizeDonationLedger(cacheLedger),
      },
      { status: 503 }
    );
  }
}
