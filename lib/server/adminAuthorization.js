import { NextResponse } from "next/server";
import { resolveModerationAdmin } from "../auth/resolveModerationAdmin";
import { safeSecretMatches } from "./requestSecurity";
export async function authorizeAdminRequest(request) {
  const context = await resolveModerationAdmin();
  if (context.owner)
    return {
      ok: true,
      admin: {
        provider: context.auth.provider,
        id: context.auth.accountId,
        name: context.auth.displayName,
      },
    };
  const secret = process.env.ADMIN_API_SECRET || process.env.ADMIN_AUTH_SECRET;
  if (safeSecretMatches(request?.headers?.get("x-admin-secret"), secret))
    return {
      ok: true,
      admin: {
        provider: "admin-secret",
        id: "admin-api-secret",
        name: "Admin API",
      },
    };
  return {
    ok: false,
    status: context.auth.authenticated ? 403 : 401,
    error: {
      ok: false,
      error: {
        code: "ADMIN_UNAUTHORIZED",
        message: "Administrator authorization is required.",
      },
    },
  };
}
export async function adminUnauthorizedResponse(result) {
  const auth = result || (await authorizeAdminRequest());
  return NextResponse.json(auth.error, { status: auth.status || 401 });
}
