import { getPayPalEnv } from "@/lib/paypal";
import { resolvePaymentAdmin } from "@/lib/auth/resolvePaymentAdmin";
import { accountPayments } from "@/lib/server/accountPaymentStore";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
export const dynamic = "force-dynamic";
export async function GET(request) {
  const { authorized, auth } = await resolvePaymentAdmin();
  if (!authorized)
    return Response.json(
      { ok: false, error: "Payment administration access required." },
      { status: auth.authenticated ? 403 : 401 },
    );
  const params = new URL(request.url).searchParams;
  const provider = params.get("provider"),
    accountId = params.get("accountId");
  if (
    (provider || accountId) &&
    (!["steam", "google"].includes(provider) ||
      !accountId ||
      accountId.length > 160)
  )
    return Response.json(
      {
        ok: false,
        error: "Provide a valid provider and account identifier together.",
      },
      { status: 400 },
    );
  try {
    const analytics = await accountPayments().summary(
      provider ? { authenticated: true, provider, accountId } : null,
    );
    const events = await getSupabaseAdmin()
      .from("account_payment_events")
      .select("event_id", { count: "exact", head: true })
      .eq("outcome", "unmatched")
      .eq("provider_environment", getPayPalEnv());
    if (events.error) throw new Error();
    return Response.json(
      {
        ok: true,
        environment: getPayPalEnv(),
        analytics,
        unmatchedEvents: events.count || 0,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, error: "Financial analytics are temporarily unavailable." },
      { status: 503 },
    );
  }
}
