import { readJsonBounded } from "@/lib/server/requestSecurity";
import { isSameOriginPaymentRequest } from "@/lib/paymentRequest";
import { cookies } from "next/headers";
import { resolveGameAuthContext } from "@/lib/auth/resolveGameAuthContext";
import { accountPayments } from "@/lib/server/accountPaymentStore";
import { paymentSelection, minorToMoney } from "@/lib/accountPayments";
import {
  createPayPalOrder,
  getPayPalCurrency,
  isPayPalConfigured,
} from "@/lib/paypal";

export async function POST(request) {
  if (!isSameOriginPaymentRequest(request))
    return Response.json(
      { ok: false, error: "Open checkout from T-Central to continue." },
      { status: 403 },
    );
  const auth = resolveGameAuthContext(await cookies());
  if (!auth.authenticated)
    return Response.json(
      { ok: false, error: "Sign in with Steam or Google before contributing." },
      { status: 401 },
    );
  if (!isPayPalConfigured())
    return Response.json(
      { ok: false, error: "Account-linked checkout is unavailable." },
      { status: 503 },
    );
  const body = await readJsonBounded(request).catch(() => null);
  if (!body || !/^[a-zA-Z0-9_-]{16,80}$/.test(body.requestId || ""))
    return Response.json(
      { ok: false, error: "A valid checkout request is required." },
      { status: 400 },
    );
  let selection;
  try {
    selection = paymentSelection(body, getPayPalCurrency().toUpperCase());
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 400 });
  }
  try {
    const store = accountPayments();
    // Commit the immutable account/price snapshot before contacting PayPal.
    const intent = await store.begin(auth, selection, body.requestId);
    if (intent.provider_id)
      return Response.json({ ok: true, orderId: intent.provider_id });
    const order = await createPayPalOrder({
      request,
      amount: minorToMoney(selection.amountMinor, selection.currency),
      currency: selection.currency,
      intentId: intent.id,
    });
    if (!order?.id) throw new Error("PayPal did not return an order.");
    await store.bind(intent, order.id);
    return Response.json(
      { ok: true, orderId: order.id, status: order.status },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        ok: false,
        error:
          "Checkout could not be prepared. Retry the same request before starting another payment.",
      },
      { status: 503 },
    );
  }
}
