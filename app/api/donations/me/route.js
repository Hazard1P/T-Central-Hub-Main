import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptJson } from '@/lib/security';
import { readDonationLedger, summarizeDonationLedger } from '@/lib/donationLedger';

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
    return NextResponse.json({ ok: true, summary: summarizeDonationLedger([]) });
  }

  const ledger = readDonationLedger().filter((entry) => entry?.steamid === steamUser.steamid);

  return NextResponse.json({
    ok: true,
    summary: summarizeDonationLedger(ledger),
  });
}
