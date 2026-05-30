import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { signValue } from '@/lib/security';
import { resolveAdminContext } from '@/lib/auth/resolveAdminContext';
import { DYSON_CONTINUITY_SCHEMA_VERSION } from '@/lib/dysonContinuity';
import { restoreService } from '@/lib/continuity/restoreService';
import { resolveAdminContext } from '@/lib/auth/resolveAdminContext';

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function isSignedInternalRequest(request, checkpointId, expectedBuildId) {
  const token = request.headers.get('x-internal-restore-token');
  if (!token) return false;
  const base = `${checkpointId}:${expectedBuildId}`;
  const signed = signValue(base);
  return safeEqual(token, signed);
}

function resolveBuildId() {
  return String(process.env.DYSON_BUILD_ID || process.env.NEXT_BUILD_ID || process.env.VERCEL_GIT_COMMIT_SHA || 'dev-build');
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_JSON_BODY' }, { status: 400 });
  }

  const checkpointId = String(body?.checkpointId || '').trim();
  const mode = body?.mode === 'validate_only' ? 'validate_only' : 'apply';
  const expectedBuildId = String(body?.expectedBuildId || '').trim();
  const expectedSchemaVersion = body?.expectedSchemaVersion;

  if (!checkpointId) {
    return NextResponse.json({ ok: false, error: 'CHECKPOINT_ID_REQUIRED' }, { status: 400 });
  }

  if (mode === 'apply') {
    if (!expectedBuildId) {
      return NextResponse.json({ ok: false, error: 'EXPECTED_BUILD_ID_REQUIRED' }, { status: 400 });
    }

    const currentBuildId = resolveBuildId();
    if (expectedBuildId !== currentBuildId) {
      return NextResponse.json({ ok: false, error: 'BUILD_ID_MISMATCH', currentBuildId, expectedBuildId }, { status: 409 });
    }
  }

  const signedInternalRequest = expectedBuildId && isSignedInternalRequest(request, checkpointId, expectedBuildId);
  if (!signedInternalRequest) {
    const adminContext = await resolveAdminContext();
    if (!adminContext.ok) {
      return NextResponse.json(
        { ok: false, error: adminContext.reason, admin: adminContext },
        { status: adminContext.status },
      );
    }
  }

  const result = await restoreService.restore(checkpointId, {
    mode,
    actor: request.headers.get('x-restore-actor') || 'api',
    expectedSchemaVersion,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: result.error === 'CHECKPOINT_NOT_FOUND' ? 404 : 409 });
  }

  return NextResponse.json({
    ok: true,
    restore: result,
    continuity: {
      schemaVersion: DYSON_CONTINUITY_SCHEMA_VERSION,
      buildId: resolveBuildId(),
    },
  });
}
