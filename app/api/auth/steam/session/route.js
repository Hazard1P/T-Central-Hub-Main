import { resolveAccountUsername } from "@/lib/server/accountUsernameStore";
export const dynamic = "force-dynamic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveGameAuthContext } from "@/lib/auth/resolveGameAuthContext";

export async function GET() {
  const authContext = await resolveAccountUsername(
    resolveGameAuthContext(await cookies()),
  );

  return NextResponse.json(
    {
      authenticated: authContext.provider === "steam",
      authContext: {
        authenticated: authContext.authenticated,
        provider: authContext.provider,
        accountId: authContext.accountId,
        displayName: authContext.displayName,
        identityKind: authContext.identityKind,
      },
      user: authContext.steamUser || null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
