import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';

export async function GET() {
  const authContext = resolveGameAuthContext(cookies());

  return NextResponse.json({
    authenticated: authContext.provider === 'google',
    authContext: {
      authenticated: authContext.authenticated,
      provider: authContext.provider,
      accountId: authContext.accountId,
      displayName: authContext.displayName,
      identityKind: authContext.identityKind,
    },
    user: authContext.googleUser || null,
  });
}
