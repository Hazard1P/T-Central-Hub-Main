import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptJson } from '@/lib/security';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';
import { buildMatrixCoinSystemStatus } from '@/lib/matrixCoinExchangeSystem';

export const dynamic = 'force-dynamic';

function readSupportSession(cookieStore) {
  const raw = cookieStore.get('support_receipt')?.value;

  if (!raw) return null;

  try {
    const payload = decryptJson(raw);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

async function readRemoteDiscrepancy() {
  const endpoint = process.env.MATRIXCOIN_DISCREPANCY_URL;
  if (!endpoint) {
    return {
      source: 'local',
      dysonDiscrepancy: 0,
      entropyBudget: 0,
      fallbackReason: 'MATRIXCOIN_DISCREPANCY_URL is not configured',
    };
  }

  try {
    const response = await fetch(endpoint, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return {
        source: 'local',
        dysonDiscrepancy: 0,
        entropyBudget: 0,
        fallbackReason: `Remote discrepancy API returned ${response.status}`,
      };
    }

    const payload = await response.json();

    return {
      source: 'remote',
      dysonDiscrepancy: payload?.dysonDiscrepancy ?? payload?.discrepancy ?? 0,
      entropyBudget: payload?.entropyBudget ?? payload?.budget ?? 0,
      fallbackReason: null,
    };
  } catch (error) {
    return {
      source: 'local',
      dysonDiscrepancy: 0,
      entropyBudget: 0,
      fallbackReason: error instanceof Error ? error.message : 'Unknown discrepancy fetch error',
    };
  }
}

export async function GET() {
  const cookieStore = cookies();
  const authContext = resolveGameAuthContext(cookieStore);
  const supportSession = readSupportSession(cookieStore);
  const discrepancyTelemetry = await readRemoteDiscrepancy();

  const status = buildMatrixCoinSystemStatus({
    authContext,
    supportSession,
    dysonDiscrepancy: discrepancyTelemetry.dysonDiscrepancy,
    entropyBudget: discrepancyTelemetry.entropyBudget,
    fallbackReason: discrepancyTelemetry.fallbackReason,
  });

  return NextResponse.json({
    ok: true,
    source: discrepancyTelemetry.source,
    status,
  });
}
