import { readJsonBounded } from "@/lib/server/requestSecurity";
import { NextResponse } from "next/server";
import { resolveModerationAdmin } from "@/lib/auth/resolveModerationAdmin";
import { moderation } from "@/lib/server/moderationStore";
import { configuredModerationAdmins } from "@/lib/moderation";
import { isSameOriginPaymentRequest } from "@/lib/paymentRequest";
import { hasRealtimeServer, realtimeCall } from "@/lib/server/realtimeBridge";
export const dynamic = "force-dynamic";
const reply = (body, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
function denied(context) {
  return reply(
    { ok: false, error: "Moderation administrator access required." },
    context.auth.authenticated ? 403 : 401,
  );
}
export async function GET(request) {
  const context = await resolveModerationAdmin();
  if (!context.authorized) return denied(context);
  try {
    return reply(
      await moderation().overview(
        new URL(request.url).searchParams.get("q") || "",
      ),
    );
  } catch (error) {
    return reply({ ok: false, error: error.message }, error.status || 503);
  }
}
export async function POST(request) {
  if (!isSameOriginPaymentRequest(request))
    return reply({ ok: false, error: "Same-origin requests required." }, 403);
  const context = await resolveModerationAdmin();
  if (!context.authorized) return denied(context);
  const body = await readJsonBounded(request).catch(() => null);
  // A report's existing target takes precedence in SQL; protect it as well as the requested target.
  try {
    const overview = body?.reference
      ? await moderation().overview(body.reference)
      : null;
    const report = overview?.reports.find(
      (item) => item.reference === body.reference,
    );
    if (body?.reference && !report)
      return reply(
        {
          ok: false,
          error:
            "Report is outside the current queue. Refresh and select a report.",
        },
        404,
      );
    const target = report?.target_key || body?.targetKey;
    if (
      ["ban", "temp_ban"].includes(body?.action) &&
      configuredModerationAdmins(process.env).includes(target)
    )
      return reply(
        {
          ok: false,
          error:
            "Remove this account from the administrator allowlist before banning it.",
        },
        400,
      );
    const result =
      body?.action === "hide_chat"
        ? await moderation().hideChat(body, context.actor)
        : await moderation().act(body, context.actor);
    let enforcement = "saved";
    if (
      ["ban", "temp_ban", "unban"].includes(result.action) &&
      hasRealtimeServer()
    ) {
      const synced = await realtimeCall("moderation", { id: result.targetKey });
      enforcement = synced.ok ? "synchronized" : "pending";
    }
    if (result.action === "hide_chat" && hasRealtimeServer()) {
      const synced = await realtimeCall("chat-moderation", {});
      enforcement = synced.ok ? "synchronized" : "pending";
    }
    return reply({ ...result, enforcement });
  } catch (error) {
    return reply(
      { ok: false, error: error.message, code: error.code },
      error.status || 503,
    );
  }
}
