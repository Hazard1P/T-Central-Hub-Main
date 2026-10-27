import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { decryptSession, decryptJson } from "@/lib/security";
import {
  getLatestSupportLedgerRecordBySteamId,
  getLatestSupportSubscriptionLedgerRecordBySteamId,
} from "@/lib/server/supportLedgerStore";

async function readEncryptedCookie(name) {
  const raw = (await cookies()).get(name)?.value;
  try {
    return raw
      ? name === "steam_session"
        ? decryptSession(raw, "steam")
        : decryptJson(raw, { purpose: "cookie:" + name })
      : null;
  } catch {
    return null;
  }
}

function isActiveSupportStatus(status) {
  return [
    "ACTIVE",
    "APPROVAL_PENDING",
    "VERIFIED",
    "CONFIRMED",
    "COMPLETED",
  ].includes(String(status || "").toUpperCase());
}

function serializeSupport(support) {
  const status = support?.status || support?.verification?.state || null;
  return support
    ? {
        provider: support.provider,
        planId: support.planId || null,
        identifier: support.identifier || support.subscriptionId,
        identifierType: support.identifierType || "subscription",
        subscriptionId:
          support.subscriptionId ||
          (support.identifierType === "subscription"
            ? support.identifier
            : null),
        steamid: support.steamid,
        personaname: support.personaname || null,
        linkedAt: support.linkedAt,
        cancelledAt:
          support.cancelledAt ||
          support.metadata?.cancelledAt ||
          support.verification?.cancelledAt ||
          null,
        status,
        active: isActiveSupportStatus(status),
        verification: support.verification || null,
        reference: support.reference || support.metadata?.reference || null,
      }
    : null;
}

export async function GET() {
  const steamUser = await readEncryptedCookie("steam_session");
  const receipt = await readEncryptedCookie("support_receipt");
  const cookieSupport =
    steamUser?.steamid && String(receipt?.steamid) === String(steamUser.steamid)
      ? receipt
      : null;

  let durableSupport = null;
  let subscriptionSupport = null;
  if (steamUser?.steamid) {
    try {
      [durableSupport, subscriptionSupport] = await Promise.all([
        getLatestSupportLedgerRecordBySteamId(steamUser.steamid),
        getLatestSupportSubscriptionLedgerRecordBySteamId(steamUser.steamid),
      ]);
    } catch {
      durableSupport = null;
      subscriptionSupport = null;
    }
  }

  const serializedDurable = serializeSupport(durableSupport);
  const serializedSubscription = serializeSupport(subscriptionSupport);
  const serializedCookie = serializeSupport(cookieSupport);
  const support = serializedSubscription?.active
    ? subscriptionSupport
    : durableSupport || subscriptionSupport || cookieSupport;

  return NextResponse.json({
    linked: Boolean(support),
    support: serializeSupport(support),
    latestSupport: serializedDurable || serializedCookie,
    subscriptionSupport: serializedSubscription,
  });
}
