import 'server-only';

import { cookies } from 'next/headers';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin';

const ADMIN_ALLOWLIST_ENV = 'ADMIN_ACCOUNT_IDS';
const ADMIN_ROLE_TABLE_ENV = 'ADMIN_ACCOUNT_ROLES_TABLE';
const LEGACY_ADMIN_ROLE_TABLE_ENV = 'ADMIN_ROLE_TABLE';

function splitAllowlist(value = '') {
  return String(value)
    .split(/[\s,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeAllowlistEntry(entry) {
  const value = String(entry || '').trim();
  if (!value) return null;

  const providerSeparator = value.indexOf(':');
  if (providerSeparator > 0) {
    const provider = value.slice(0, providerSeparator).trim().toLowerCase();
    const accountId = value.slice(providerSeparator + 1).trim();
    if (provider && accountId) return { provider, accountId };
  }

  return { provider: null, accountId: value };
}

function isAccountAllowlisted({ accountId, provider }, allowlistValue = process.env[ADMIN_ALLOWLIST_ENV]) {
  if (!accountId) return false;

  const normalizedProvider = provider ? String(provider).toLowerCase() : null;
  const normalizedAccountId = String(accountId);

  return splitAllowlist(allowlistValue).some((entry) => {
    const allowlistEntry = normalizeAllowlistEntry(entry);
    if (!allowlistEntry) return false;
    if (allowlistEntry.accountId !== normalizedAccountId) return false;
    return !allowlistEntry.provider || allowlistEntry.provider === normalizedProvider;
  });
}

function resolveAdminRoleTableName() {
  return String(process.env[ADMIN_ROLE_TABLE_ENV] || process.env[LEGACY_ADMIN_ROLE_TABLE_ENV] || '').trim();
}

function rowHasAdminRole(row) {
  if (!row || typeof row !== 'object') return false;
  if (row.is_admin === true || row.isAdmin === true) return true;

  const role = String(row.role || row.account_role || row.accountRole || '').trim().toLowerCase();
  return ['admin', 'owner', 'dyson_admin', 'dyson-parameter-admin'].includes(role);
}

async function resolveSupabaseAdminRole({ accountId, provider }) {
  const tableName = resolveAdminRoleTableName();
  if (!tableName) return { ok: false, reason: 'ADMIN_ROLE_TABLE_NOT_CONFIGURED' };

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, reason: 'SUPABASE_ADMIN_NOT_CONFIGURED' };

  const normalizedProvider = provider ? String(provider).toLowerCase() : null;

  let query = admin
    .from(tableName)
    .select('account_id, provider, role, is_admin, account_role')
    .eq('account_id', String(accountId))
    .limit(1);

  if (normalizedProvider) query = query.eq('provider', normalizedProvider);

  const { data, error } = await query.maybeSingle();

  if (error) {
    return { ok: false, reason: 'ADMIN_ROLE_LOOKUP_FAILED', error };
  }

  return rowHasAdminRole(data)
    ? { ok: true, reason: 'ADMIN_ROLE_MATCH' }
    : { ok: false, reason: 'ADMIN_ROLE_REQUIRED' };
}

export async function resolveAdminContext(cookieStore = cookies()) {
  const authContext = resolveGameAuthContext(cookieStore);
  const accountId = authContext.accountId ? String(authContext.accountId) : null;
  const provider = authContext.provider || null;

  if (!authContext.authenticated || !accountId) {
    return {
      ok: false,
      status: 401,
      accountId,
      provider,
      reason: 'UNAUTHENTICATED',
    };
  }

  if (isAccountAllowlisted({ accountId, provider })) {
    return {
      ok: true,
      status: 200,
      accountId,
      provider,
      reason: 'ADMIN_ALLOWLIST_MATCH',
    };
  }

  const roleResult = await resolveSupabaseAdminRole({ accountId, provider });
  if (roleResult.ok) {
    return {
      ok: true,
      status: 200,
      accountId,
      provider,
      reason: roleResult.reason,
    };
  }

  return {
    ok: false,
    status: 403,
    accountId,
    provider,
    reason: roleResult.reason || 'ADMIN_ACCOUNT_REQUIRED',
  };
}

export const adminContextInternals = {
  isAccountAllowlisted,
  normalizeAllowlistEntry,
  splitAllowlist,
};
