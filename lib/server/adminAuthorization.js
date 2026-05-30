import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptJson } from '@/lib/security';

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function resolveAdminSession() {
  const cookieStore = cookies();
  const raw = cookieStore.get('steam_session')?.value;
  if (!raw) return null;

  try {
    const session = decryptJson(raw);
    if (session?.is_admin || session?.isAdmin || session?.role === 'admin') {
      return {
        provider: 'steam',
        id: session.steamid || session.id || 'admin-session',
        name: session.personaname || session.displayName || 'Admin',
      };
    }
  } catch {
    return null;
  }

  return null;
}

function resolveAdminHeader(request) {
  const expectedSecret = process.env.ADMIN_API_SECRET || process.env.ADMIN_AUTH_SECRET;
  if (!expectedSecret) return null;

  const suppliedSecret = request?.headers?.get('x-admin-secret');
  if (!suppliedSecret || !safeEqual(suppliedSecret, expectedSecret)) return null;

  return {
    provider: 'admin-secret',
    id: 'admin-api-secret',
    name: 'Admin API Secret',
  };
}

export function authorizeAdminRequest(request) {
  const sessionAdmin = resolveAdminSession();
  if (sessionAdmin) return { ok: true, admin: sessionAdmin };

  const headerAdmin = resolveAdminHeader(request);
  if (headerAdmin) return { ok: true, admin: headerAdmin };

  return {
    ok: false,
    status: 401,
    error: {
      ok: false,
      error: {
        code: 'ADMIN_UNAUTHORIZED',
        message: 'Admin authorization is required for this endpoint.',
      },
    },
  };
}

export function adminUnauthorizedResponse(authResult = null) {
  const result = authResult || authorizeAdminRequest();
  return NextResponse.json(result.error, { status: result.status || 401 });
}
