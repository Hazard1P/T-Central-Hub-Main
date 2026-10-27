import { readJsonBounded } from "@/lib/server/requestSecurity";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveGameAuthContext } from "@/lib/auth/resolveGameAuthContext";
import { resolveAccountUsername } from "@/lib/server/accountUsernameStore";
import { moderation } from "@/lib/server/moderationStore";
import { REPORT_REASONS } from "@/lib/moderation";
import { isSameOriginPaymentRequest } from "@/lib/paymentRequest";

export const dynamic = "force-dynamic";
const reply = (body, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET() {
  const auth = await resolveAccountUsername(
    resolveGameAuthContext(await cookies()),
  );
  return reply({
    ok: true,
    reporterName: auth.displayName || "Guest reporter",
    authenticated: auth.authenticated,
    publicMeta: {
      allowedReasons: REPORT_REASONS,
      reportColumns: [
        "Reported player",
        "Server or location",
        "Reason",
        "Evidence or notes",
      ],
    },
  });
}
export async function POST(request) {
  if (!isSameOriginPaymentRequest(request))
    return reply({ ok: false, error: "Same-origin requests required." }, 403);
  const body = await readJsonBounded(request).catch(() => null);
  const auth = await resolveAccountUsername(
    resolveGameAuthContext(await cookies()),
  );
  const reporter = auth.authenticated
    ? {
        accountKey: `${auth.provider}:${auth.accountId}`,
        displayName: auth.displayName,
      }
    : null;
  const address =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateKey =
    reporter?.accountKey ||
    "guest:" + createHash("sha256").update(address).digest("hex");
  try {
    return reply(await moderation().submit(body, reporter, rateKey), 201);
  } catch (error) {
    return reply(
      { ok: false, error: error.message, code: error.code },
      error.status || 503,
    );
  }
}
