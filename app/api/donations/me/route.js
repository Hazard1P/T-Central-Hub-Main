import { getPayPalEnv } from "@/lib/paypal";
import { cookies } from "next/headers";
import { resolveGameAuthContext } from "@/lib/auth/resolveGameAuthContext";
import { accountPayments } from "@/lib/server/accountPaymentStore";

export const dynamic = "force-dynamic";
export async function GET() {
  const auth = resolveGameAuthContext(await cookies());
  const headers = { "Cache-Control": "private, no-store" };
  if (!auth.authenticated)
    return Response.json(
      { ok: false, error: "Sign in to see your private contribution history." },
      { status: 401, headers },
    );
  try {
    return Response.json(
      {
        ok: true,
        environment: getPayPalEnv(),
        owner: { provider: auth.provider, accountId: auth.accountId },
        analytics: await accountPayments().summary(auth),
        vipSalesAvailable: false,
      },
      { headers },
    );
  } catch {
    return Response.json(
      {
        ok: false,
        unavailable: true,
        error:
          "Your payment history is temporarily unavailable. This does not mean your contributions were erased.",
      },
      { status: 503, headers },
    );
  }
}
