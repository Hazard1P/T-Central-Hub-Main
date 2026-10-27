import { cookies } from "next/headers";
import { resolveGameAuthContext } from "@/lib/auth/resolveGameAuthContext";
import {
  isModerationAdmin,
  configuredModerationAdmins,
  configuredSiteOwner,
} from "@/lib/moderation";
export async function resolveModerationAdmin() {
  const auth = resolveGameAuthContext(await cookies());
  return {
    auth,
    authorized: isModerationAdmin(
      auth,
      configuredModerationAdmins(process.env).join(","),
    ),
    owner:
      auth.authenticated &&
      `${auth.provider}:${auth.accountId}` === configuredSiteOwner(process.env),
    actor: `${auth.provider}:${auth.accountId}`,
  };
}
