import { cookies } from 'next/headers';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';

const ADMIN_ACCOUNT_ENV_KEYS = [
  'ADMIN_ACCOUNT_ID',
  'ADMIN_ACCOUNT_IDS',
  'T_CENTRAL_ADMIN_ACCOUNT_ID',
  'T_CENTRAL_ADMIN_ACCOUNT_IDS',
  'DYSON_ADMIN_ACCOUNT_ID',
  'DYSON_ADMIN_ACCOUNT_IDS',
];

const ADMIN_STEAM_ENV_KEYS = [
  'ADMIN_STEAM_ID',
  'ADMIN_STEAM_IDS',
  'T_CENTRAL_ADMIN_STEAM_ID',
  'T_CENTRAL_ADMIN_STEAM_IDS',
  'DYSON_ADMIN_STEAM_ID',
  'DYSON_ADMIN_STEAM_IDS',
];

const ADMIN_GOOGLE_SUB_ENV_KEYS = [
  'ADMIN_GOOGLE_SUB',
  'ADMIN_GOOGLE_SUBS',
  'ADMIN_GOOGLE_ID',
  'ADMIN_GOOGLE_IDS',
  'T_CENTRAL_ADMIN_GOOGLE_SUB',
  'T_CENTRAL_ADMIN_GOOGLE_SUBS',
  'DYSON_ADMIN_GOOGLE_SUB',
  'DYSON_ADMIN_GOOGLE_SUBS',
];

const ADMIN_GOOGLE_EMAIL_ENV_KEYS = [
  'ADMIN_GOOGLE_EMAIL',
  'ADMIN_GOOGLE_EMAILS',
  'T_CENTRAL_ADMIN_GOOGLE_EMAIL',
  'T_CENTRAL_ADMIN_GOOGLE_EMAILS',
  'DYSON_ADMIN_GOOGLE_EMAIL',
  'DYSON_ADMIN_GOOGLE_EMAILS',
];

function readAdminValues(keys, { lowercase = false } = {}) {
  return new Set(
    keys
      .flatMap((key) => String(process.env[key] || '').split(/[\s,;]+/))
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => (lowercase ? value.toLowerCase() : value))
  );
}

function getConfiguredAdminAccounts() {
  return {
    accountIds: readAdminValues(ADMIN_ACCOUNT_ENV_KEYS),
    steamIds: readAdminValues(ADMIN_STEAM_ENV_KEYS),
    googleSubjectIds: readAdminValues(ADMIN_GOOGLE_SUB_ENV_KEYS),
    googleEmails: readAdminValues(ADMIN_GOOGLE_EMAIL_ENV_KEYS, { lowercase: true }),
  };
}

function hasConfiguredAdminAccount(configuredAdmins) {
  return Object.values(configuredAdmins).some((values) => values.size > 0);
}

function matchesConfiguredAdmin(authContext, configuredAdmins) {
  const provider = authContext.provider;
  const accountId = authContext.accountId ? String(authContext.accountId) : '';
  const providerScopedAccountId = provider && accountId ? `${provider}:${accountId}` : '';
  const googleEmail = authContext.googleUser?.email ? String(authContext.googleUser.email).toLowerCase() : '';

  if (!provider || !accountId) return false;
  if (configuredAdmins.accountIds.has(accountId) || configuredAdmins.accountIds.has(providerScopedAccountId)) return true;
  if (provider === 'steam' && configuredAdmins.steamIds.has(accountId)) return true;
  if (provider === 'google' && configuredAdmins.googleSubjectIds.has(accountId)) return true;
  if (provider === 'google' && googleEmail && configuredAdmins.googleEmails.has(googleEmail)) return true;

  return false;
}

export function resolveAdminContext(cookieStore = cookies()) {
  const authContext = resolveGameAuthContext(cookieStore);
  const configuredAdmins = getConfiguredAdminAccounts();

  if (!authContext.authenticated) {
    return {
      ok: false,
      reason: 'AUTHENTICATION_REQUIRED',
      authenticated: false,
      isConfiguredAdmin: false,
      authContext,
    };
  }

  const adminConfigured = hasConfiguredAdminAccount(configuredAdmins);
  const isConfiguredAdmin = adminConfigured && matchesConfiguredAdmin(authContext, configuredAdmins);

  return {
    ok: isConfiguredAdmin,
    reason: isConfiguredAdmin ? 'ADMIN_AUTHORIZED' : adminConfigured ? 'ACCESS_DENIED' : 'ADMIN_NOT_CONFIGURED',
    authenticated: true,
    isConfiguredAdmin,
    authContext,
  };
}
