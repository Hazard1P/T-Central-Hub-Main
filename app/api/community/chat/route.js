import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveGameAuthContext } from "@/lib/auth/resolveGameAuthContext";
import { resolveAccountUsername } from "@/lib/server/accountUsernameStore";
import { resolveGuestPilotSession } from "@/lib/guestPilotIdentity";
import { isSameOriginPaymentRequest } from "@/lib/paymentRequest";
import { hasRealtimeServer } from "@/lib/server/realtimeBridge";
import { signChatTicket } from "@/lib/realtime/chatTickets";
import { moderation } from "@/lib/server/moderationStore";
import { banDenial } from "@/lib/moderation";
export const dynamic = "force-dynamic";
const reply = (body, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function POST(request) {
  if (!isSameOriginPaymentRequest(request))
    return reply({ ok: false, error: "Same-origin requests required." }, 403);
  if (!hasRealtimeServer())
    return reply({ ok: false, error: "Live chat is being configured." }, 503);
  const cookieStore = cookies(),
    auth = await resolveAccountUsername(resolveGameAuthContext(cookieStore));
  const guest = auth.authenticated
    ? null
    : resolveGuestPilotSession(cookieStore.get("tcentral_guest_pilot")?.value);
  const identity = {
    id: auth.authenticated ? `${auth.provider}:${auth.accountId}` : guest.id,
    displayName: auth.displayName || "Visitor",
    identityKind: auth.provider || "guest",
    authenticated: auth.authenticated,
  };
  const access = banDenial(
    await moderation().access([identity.id]),
    identity.id,
  );
  if (!access.ok) return reply(access, access.status);
  const endpoint = new URL(process.env.NEXT_PUBLIC_REALTIME_WS_URL);
  endpoint.pathname = "/chat";
  endpoint.search = "";
  endpoint.hash = "";
  const response = reply({
    ok: true,
    endpoint: endpoint.href,
    ticket: signChatTicket(identity, process.env.REALTIME_SERVER_SECRET),
    canSend: identity.authenticated,
    displayName: identity.displayName,
  });
  if (guest?.setCookie)
    response.cookies.set("tcentral_guest_pilot", guest.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  return response;
}
