import { cookies } from 'next/headers';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';

export const ADMIN_SESSION_REQUIRED = 'ADMIN_SESSION_REQUIRED';
export const ADMIN_ACCESS_DENIED = 'ADMIN_ACCESS_DENIED';

function buildDeniedContext(authContext, status, error) {
  return {
    authorized: false,
    authenticated: Boolean(authContext?.authenticated),
    provider: authContext?.provider || null,
    accountId: authContext?.accountId ? String(authContext.accountId) : null,
    status,
    error,
    authContext,
  };
}

export function resolveAdminContext(cookieStore = cookies()) {
  const authContext = resolveGameAuthContext(cookieStore);
  const hasSupportedSession = Boolean(
    authContext?.authenticated
      && (authContext.provider === 'steam' || authContext.provider === 'google')
      && authContext.accountId
  );

  if (!hasSupportedSession) {
    return buildDeniedContext(authContext, 401, ADMIN_SESSION_REQUIRED);
  }

  const configuredAdminAccountId = String(process.env.DYSON_ADMIN_ACCOUNT_ID || '').trim();
  const sessionAccountId = String(authContext.accountId);

  if (!configuredAdminAccountId || sessionAccountId !== configuredAdminAccountId) {
    return buildDeniedContext(authContext, 403, ADMIN_ACCESS_DENIED);
  }

  return {
    authorized: true,
    authenticated: true,
    provider: authContext.provider,
    accountId: sessionAccountId,
    status: 200,
    error: null,
    authContext,
  };
}

export function toAdminAuthErrorResponse(adminContext) {
  return {
    error: adminContext?.error === ADMIN_ACCESS_DENIED ? ADMIN_ACCESS_DENIED : ADMIN_SESSION_REQUIRED,
  };
}
