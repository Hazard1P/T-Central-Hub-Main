import { readJsonBounded } from "@/lib/server/requestSecurity";
import { isSameOriginPaymentRequest } from "@/lib/paymentRequest";
import { cookies } from "next/headers";
import { resolveGameAuthContext } from "@/lib/auth/resolveGameAuthContext";
import { accountPayments } from "@/lib/server/accountPaymentStore";
import { monthlySupportPlan } from "@/lib/server/monthlySupportPlan";
import { moneyToMinor } from "@/lib/accountPayments";
import {
  createPayPalSubscription,
  getPayPalSubscriptionPlanId,
} from "@/lib/paypal";

export async function POST(request) {
  if (!isSameOriginPaymentRequest(request))
    return Response.json(
      { ok: false, error: "Open checkout from T-Central to continue." },
      { status: 403 },
    );
  const auth = resolveGameAuthContext(await cookies());
  // Existing subscription-management and cancellation tools are Steam-bound.
  if (!auth.authenticated || auth.provider !== "steam")
    return Response.json(
      {
        ok: false,
        error:
          "Monthly support currently requires a Steam account. Google accounts can make one-time contributions.",
      },
      { status: 401 },
    );
  const body = await readJsonBounded(request).catch(() => null);
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(body?.requestId || ""))
    return Response.json(
      { ok: false, error: "A valid checkout request is required." },
      { status: 400 },
    );
  if (body?.planId && body.planId !== getPayPalSubscriptionPlanId())
    return Response.json(
      { ok: false, error: "Unsupported plan." },
      { status: 400 },
    );
  try {
    const plan = await monthlySupportPlan();
    if (!plan)
      return Response.json(
        { ok: false, error: "Monthly support is currently unavailable." },
        { status: 503 },
      );
    const store = accountPayments();
    const intent = await store.begin(
      auth,
      {
        kind: "support_subscription",
        focus: "general",
        amountMinor: moneyToMinor(plan.amount, plan.currency),
        currency: plan.currency,
        product: {
          name: "Voluntary monthly support",
          version: 1,
          planId: getPayPalSubscriptionPlanId(),
          benefits: [],
        },
      },
      body.requestId,
      "subscription",
    );
    if (intent.provider_id)
      return Response.json({ ok: true, subscriptionId: intent.provider_id });
    const subscription = await createPayPalSubscription({
      request,
      steamUser: auth.steamUser,
      planId: getPayPalSubscriptionPlanId(),
      idempotencyKey: intent.id,
    });
    if (!subscription?.id) throw new Error("Missing subscription ID");
    await store.bind(intent, subscription.id);
    return Response.json({
      ok: true,
      subscriptionId: subscription.id,
      status: subscription.status,
    });
  } catch {
    return Response.json(
      {
        ok: false,
        error:
          "Monthly checkout could not be prepared. Retry the same request.",
      },
      { status: 503 },
    );
  }
}
