import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptJson } from '@/lib/security';
import { getLatestSupportLedgerRecordBySteamId } from '@/lib/server/supportLedgerStore';

function readEncryptedCookie(name) {
  const raw = cookies().get(name)?.value;
  try {
    return raw ? decryptJson(raw) : null;
  } catch {
    return null;
  }
}

function serializeSupport(support) {
  return support
    ? {
        provider: support.provider,
        planId: support.planId || null,
        identifier: support.identifier || support.subscriptionId,
        identifierType: support.identifierType || 'subscription',
        subscriptionId: support.subscriptionId || (support.identifierType === 'subscription' ? support.identifier : null),
        steamid: support.steamid,
        personaname: support.personaname || null,
        linkedAt: support.linkedAt,
        verification: support.verification || null,
        reference: support.reference || support.metadata?.reference || null,
      }
    : null;
}

export async function GET() {
  const cookieSupport = readEncryptedCookie('support_receipt');
  const steamUser = readEncryptedCookie('steam_session');

  let durableSupport = null;
  if (steamUser?.steamid) {
    try {
      durableSupport = await getLatestSupportLedgerRecordBySteamId(steamUser.steamid);
    } catch {
      durableSupport = null;
    }
  }

  const support = durableSupport || cookieSupport;

  return NextResponse.json({
    linked: Boolean(support),
    support: serializeSupport(support),
  });
}
