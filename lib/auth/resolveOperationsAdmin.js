import { resolveModerationAdmin } from "./resolveModerationAdmin";
import { isMaintenanceRequest } from "../server/requestSecurity";
import { isSameOriginPaymentRequest } from "../paymentRequest";
export async function resolveOperationsAdmin(request) {
  if (isMaintenanceRequest(request))
    return { authorized: true, actor: "maintenance-service", status: 200 };
  const context = await resolveModerationAdmin();
  if (context.owner && isSameOriginPaymentRequest(request))
    return { authorized: true, actor: context.actor, status: 200 };
  return {
    authorized: false,
    status: context.auth.authenticated ? 403 : 401,
    error: "Owner or maintenance authorization required.",
  };
}
