import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptJson } from '@/lib/security';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';
import { buildMatrixCoinSystemStatus } from '@/lib/matrixCoinExchangeSystem';
import { MATRIXCOIN_NODE_KEY, loadMatrixCoinWallet, recordMatrixCoinSettlement } from '@/lib/server/matrixCoinExchangeStore';

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
  const walletState = authContext.authenticated
    ? await loadMatrixCoinWallet(authContext, { modeScope: `singleplayer:${MATRIXCOIN_NODE_KEY}` })
    : { ok: false, storage: 'none', wallet: null };

  return NextResponse.json({
    ok: true,
    source: discrepancyTelemetry.source,
    status,
    matrixCoinWallet: walletState.wallet || null,
    walletStorage: walletState.storage,
  });
}


function resolveModeScope(body = {}) {
  const requested = typeof body?.modeScope === 'string' ? body.modeScope : null;
  if (requested && /^(singleplayer|multiplayer):[A-Za-z0-9_-]+$/.test(requested)) return requested;
  return `singleplayer:${MATRIXCOIN_NODE_KEY}`;
}

export async function POST(request) {
  const authContext = resolveGameAuthContext(cookies());
  if (!authContext.authenticated) {
    return NextResponse.json({
      ok: false,
      error: 'AUTHENTICATED_ACCOUNT_REQUIRED',
      message: 'MatrixCoinExchange settlements require a linked authenticated account before durable wallet storage is written.',
    }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || body.nodeKey !== MATRIXCOIN_NODE_KEY) {
    return NextResponse.json({
      ok: false,
      error: 'INVALID_MATRIXCOIN_NODE',
      message: 'Settlements must target the matrixcoinexchange node.',
    }, { status: 400 });
  }

  const settlement = await recordMatrixCoinSettlement(authContext, {
    modeScope: resolveModeScope(body),
    idempotencyKey: body.idempotencyKey,
    originEventId: body.originEventId,
    entropyUnits: body.entropyUnits,
    stabilizedEntropy: body.stabilizedEntropy,
    creditQuote: body.creditQuote,
    creditMicroEc: body.creditMicroEc,
    routeIntegrity: body.routeIntegrity,
    tickId: body.tickId,
    telemetry: body.telemetry,
  });

  return NextResponse.json({
    ok: settlement.ok,
    storage: settlement.storage,
    duplicate: Boolean(settlement.duplicate),
    wallet: settlement.wallet || null,
    ledgerEntry: settlement.ledgerEntry || null,
    settlement: settlement.settlement || null,
    warning: settlement.ok ? null : settlement.reason || 'MatrixCoinExchange durable persistence is not configured.',
  }, { status: settlement.ok ? 200 : 202 });
}
