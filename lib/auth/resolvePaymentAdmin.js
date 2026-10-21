import { cookies } from 'next/headers';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';
export function resolvePaymentAdmin() {
  const auth = resolveGameAuthContext(cookies());
  return { authorized: Boolean(auth.authenticated && ['steam','google'].includes(process.env.PAYMENTS_ADMIN_PROVIDER) && auth.provider === process.env.PAYMENTS_ADMIN_PROVIDER && auth.accountId === process.env.PAYMENTS_ADMIN_ACCOUNT_ID), auth };
}
