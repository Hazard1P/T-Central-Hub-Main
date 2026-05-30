import { cookies } from 'next/headers';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';

const ADMIN_SESSION_REQUIRED = 'ADMIN_SESSION_REQUIRED';
const ADMIN_ACCESS_FORBIDDEN = 'ADMIN_ACCESS_FORBIDDEN';

function normalizeProvider(provider) {
  const value = String(provider || '').trim().toLowerCase();
  return value || null;
}

export function evaluateAdminContext(authContext, env = process.env) {
  const adminAccountId = env?.DYSON_ADMIN_ACCOUNT_ID == null ? '' : String(env.DYSON_ADMIN_ACCOUNT_ID);
  const adminProvider = normalizeProvider(env?.DYSON_ADMIN_PROVIDER);
  const authenticated = authContext?.authenticated === true;
  const accountMatches = adminAccountId.length > 0 && String(authContext?.accountId) === adminAccountId;
  const providerMatches = !adminProvider || normalizeProvider(authContext?.provider) === adminProvider;
  const isAdmin = authenticated && accountMatches && providerMatches;

  if (isAdmin) {
    return {
      isAdmin: true,
      status: 200,
      code: null,
      authenticated,
      authContext,
      adminProvider,
      adminAccountConfigured: true,
    };
  }

  const status = authenticated ? 403 : 401;
  const code = authenticated ? ADMIN_ACCESS_FORBIDDEN : ADMIN_SESSION_REQUIRED;

  return {
    isAdmin: false,
    status,
    code,
    authenticated,
    authContext,
    adminProvider,
    adminAccountConfigured: adminAccountId.length > 0,
  };
}

export function resolveAdminContext(cookieStore = cookies(), env = process.env) {
  const authContext = resolveGameAuthContext(cookieStore);
  return evaluateAdminContext(authContext, env);
}
