import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin';
import { trackServerEvent } from '@/lib/server/vercelTelemetry';

export const MATRIXCOIN_NODE_KEY = 'matrixcoinexchange';
export const MATRIXCOIN_WALLETS_TABLE = 'matrixcoin_wallets';
export const MATRIXCOIN_LEDGER_TABLE = 'matrixcoin_ledger_entries';
export const MATRIXCOIN_SETTLEMENTS_TABLE = 'matrixcoin_settlements';
export const MICRO_EC_PER_CREDIT = 1_000_000;

const DATA_DIR = path.join(process.cwd(), 'data');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
const GENESIS_HASH_PREFIX = 'matrixcoinexchange-genesis';

function allowLocalJsonFallback() {
  return !IS_PRODUCTION && !IS_VERCEL;
}

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readJsonArray(filename) {
  await ensureDataDir();
  try {
    const raw = await readFile(path.join(DATA_DIR, filename), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeJsonArray(filename, records) {
  await ensureDataDir();
  await writeFile(path.join(DATA_DIR, filename), JSON.stringify(records, null, 2), 'utf8');
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashValue(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function normalizeModeScope(modeScope = `singleplayer:${MATRIXCOIN_NODE_KEY}`) {
  const normalized = String(modeScope || '').trim();
  return /^(singleplayer|multiplayer):[A-Za-z0-9_-]+$/.test(normalized) ? normalized : `singleplayer:${MATRIXCOIN_NODE_KEY}`;
}

export function resolveMatrixCoinAccountIdentity(authContext = {}) {
  if (!authContext?.authenticated || !authContext.provider || !authContext.accountId) {
    return null;
  }

  const accountProvider = String(authContext.provider).trim().toLowerCase();
  const accountId = String(authContext.accountId).trim();
  if (!accountProvider || !accountId) return null;

  return {
    identityId: `${accountProvider}:${accountId}`,
    accountProvider,
    accountId,
    displayName: authContext.displayName || 'Linked Pilot',
    playerId: `${accountProvider}:${accountId}`,
  };
}

function normalizeWalletRecord(record = {}) {
  if (!record) return null;
  return {
    walletId: record.wallet_id,
    identityId: record.identity_id,
    accountProvider: record.account_provider,
    accountId: record.account_id,
    displayName: record.display_name,
    playerId: record.player_id,
    nodeKey: record.node_key || MATRIXCOIN_NODE_KEY,
    modeScope: record.mode_scope,
    status: record.status,
    availableMicroEc: Number(record.available_micro_ec || 0),
    reservedMicroEc: Number(record.reserved_micro_ec || 0),
    lifetimeMintedMicroEc: Number(record.lifetime_minted_micro_ec || 0),
    lifetimeBurnedMicroEc: Number(record.lifetime_burned_micro_ec || 0),
    lastUpdatedAt: record.last_updated_at,
    createdAt: record.created_at,
  };
}

function normalizeLedgerRecord(record = {}) {
  if (!record) return null;
  return {
    transactionId: record.transaction_id,
    walletId: record.wallet_id,
    identityId: record.identity_id,
    eventSeq: Number(record.event_seq || 0),
    tickId: Number(record.tick_id || 0),
    entryType: record.entry_type,
    amountMicroEc: Number(record.amount_micro_ec || 0),
    idempotencyKey: record.idempotency_key,
    originEventId: record.origin_event_id,
    previousHash: record.previous_hash,
    entryHash: record.entry_hash,
    settlementState: record.settlement_state,
    recordedAt: record.recorded_at,
    metadata: record.metadata || {},
  };
}

function buildWalletPayload(identity, modeScope, now = new Date().toISOString()) {
  return {
    identity_id: identity.identityId,
    account_provider: identity.accountProvider,
    account_id: identity.accountId,
    display_name: identity.displayName,
    player_id: identity.playerId,
    node_key: MATRIXCOIN_NODE_KEY,
    mode_scope: normalizeModeScope(modeScope),
    status: 'active',
    last_updated_at: now,
  };
}

async function ensureLocalWallet(identity, modeScope) {
  const now = new Date().toISOString();
  const current = await readJsonArray('matrixcoin-wallets.json');
  const normalizedModeScope = normalizeModeScope(modeScope);
  const existing = current.find((item) => item.identity_id === identity.identityId && item.node_key === MATRIXCOIN_NODE_KEY && item.mode_scope === normalizedModeScope);

  if (existing) return normalizeWalletRecord(existing);

  const wallet = {
    wallet_id: hashValue({ identity: identity.identityId, modeScope: normalizedModeScope }).slice(0, 32),
    ...buildWalletPayload(identity, normalizedModeScope, now),
    available_micro_ec: 0,
    reserved_micro_ec: 0,
    lifetime_minted_micro_ec: 0,
    lifetime_burned_micro_ec: 0,
    created_at: now,
  };

  await writeJsonArray('matrixcoin-wallets.json', [wallet, ...current].slice(0, 500));
  await trackServerEvent('api_persistence', { table: MATRIXCOIN_WALLETS_TABLE, ok: true, storage: 'json-local' });
  return normalizeWalletRecord(wallet);
}


export async function loadMatrixCoinWallet(authContext, { modeScope = `singleplayer:${MATRIXCOIN_NODE_KEY}` } = {}) {
  const identity = resolveMatrixCoinAccountIdentity(authContext);
  if (!identity) {
    return { ok: false, storage: 'none', reason: 'AUTHENTICATED_ACCOUNT_REQUIRED', wallet: null };
  }

  const normalizedModeScope = normalizeModeScope(modeScope);
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from(MATRIXCOIN_WALLETS_TABLE)
      .select('*')
      .eq('identity_id', identity.identityId)
      .eq('node_key', MATRIXCOIN_NODE_KEY)
      .eq('mode_scope', normalizedModeScope)
      .maybeSingle();

    if (!error && data) {
      return { ok: true, storage: 'supabase', wallet: normalizeWalletRecord(data), identity };
    }
    if (error) {
      await trackServerEvent('api_persistence', { table: MATRIXCOIN_WALLETS_TABLE, ok: false, storage: 'supabase', reason: error.message.slice(0, 120) });
    }
  }

  if (!allowLocalJsonFallback()) return { ok: false, storage: 'none', reason: 'MATRIXCOIN_WALLET_NOT_FOUND', wallet: null, identity };

  const current = await readJsonArray('matrixcoin-wallets.json');
  const found = current.find((item) => item.identity_id === identity.identityId && item.node_key === MATRIXCOIN_NODE_KEY && item.mode_scope === normalizedModeScope);
  if (found) return { ok: true, storage: 'json-local', wallet: normalizeWalletRecord(found), identity };
  return { ok: false, storage: 'none', reason: 'MATRIXCOIN_WALLET_NOT_FOUND', wallet: null, identity };
}

export async function ensureMatrixCoinWallet(authContext, { modeScope = `singleplayer:${MATRIXCOIN_NODE_KEY}` } = {}) {
  const identity = resolveMatrixCoinAccountIdentity(authContext);
  if (!identity) {
    return { ok: false, storage: 'none', reason: 'AUTHENTICATED_ACCOUNT_REQUIRED' };
  }

  const payload = buildWalletPayload(identity, modeScope);
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from(MATRIXCOIN_WALLETS_TABLE)
      .upsert(payload, { onConflict: 'identity_id,node_key,mode_scope' })
      .select('*')
      .single();

    if (!error && data) {
      await trackServerEvent('api_persistence', { table: MATRIXCOIN_WALLETS_TABLE, ok: true, storage: 'supabase' });
      return { ok: true, storage: 'supabase', wallet: normalizeWalletRecord(data), identity };
    }

    await trackServerEvent('api_persistence', { table: MATRIXCOIN_WALLETS_TABLE, ok: false, storage: 'supabase', reason: error?.message?.slice(0, 120) || 'UPSERT_FAILED' });
    if (!allowLocalJsonFallback()) return { ok: false, storage: 'none', reason: error?.message || 'MATRIXCOIN_WALLET_UPSERT_FAILED' };
  }

  if (!allowLocalJsonFallback()) return { ok: false, storage: 'none', reason: 'DURABLE_PERSISTENCE_NOT_CONFIGURED' };
  return { ok: true, storage: 'json-local', wallet: await ensureLocalWallet(identity, modeScope), identity };
}

async function appendLocalLedgerEntry(wallet, entry) {
  const currentLedger = await readJsonArray('matrixcoin-ledger-entries.json');
  const duplicate = currentLedger.find((item) => item.idempotency_key === entry.idempotencyKey);
  const currentWallets = await readJsonArray('matrixcoin-wallets.json');

  if (duplicate) {
    return { ok: true, storage: 'json-local', duplicate: true, ledgerEntry: normalizeLedgerRecord(duplicate), wallet };
  }

  const previousEntry = currentLedger.find((item) => item.wallet_id === wallet.walletId);
  const now = new Date().toISOString();
  const eventSeq = previousEntry ? Number(previousEntry.event_seq || 0) + 1 : 0;
  const previousHash = previousEntry?.entry_hash || `${GENESIS_HASH_PREFIX}:${wallet.walletId}`;
  const ledgerPayload = {
    transaction_id: hashValue({ idempotencyKey: entry.idempotencyKey, walletId: wallet.walletId }).slice(0, 32),
    wallet_id: wallet.walletId,
    identity_id: wallet.identityId,
    event_seq: eventSeq,
    tick_id: entry.tickId || 0,
    entry_type: entry.entryType,
    amount_micro_ec: entry.amountMicroEc,
    idempotency_key: entry.idempotencyKey,
    origin_event_id: entry.originEventId,
    mint_reason_code: entry.mintReasonCode || null,
    previous_hash: previousHash,
    entry_hash: hashValue({ walletId: wallet.walletId, eventSeq, previousHash, entry }),
    settlement_state: entry.settlementState || 'settled',
    metadata: entry.metadata || {},
    recorded_at: now,
  };

  const walletRecord = currentWallets.find((item) => item.wallet_id === wallet.walletId);
  if (walletRecord) {
    const amount = Number(entry.amountMicroEc || 0);
    if (['mint', 'conversion', 'settlement'].includes(entry.entryType)) {
      walletRecord.available_micro_ec = Number(walletRecord.available_micro_ec || 0) + amount;
      walletRecord.lifetime_minted_micro_ec = Number(walletRecord.lifetime_minted_micro_ec || 0) + amount;
    } else if (entry.entryType === 'sink') {
      walletRecord.available_micro_ec = Math.max(0, Number(walletRecord.available_micro_ec || 0) - amount);
      walletRecord.lifetime_burned_micro_ec = Number(walletRecord.lifetime_burned_micro_ec || 0) + amount;
    }
    walletRecord.last_updated_at = now;
    await writeJsonArray('matrixcoin-wallets.json', currentWallets);
  }

  await writeJsonArray('matrixcoin-ledger-entries.json', [ledgerPayload, ...currentLedger].slice(0, 1000));
  await trackServerEvent('api_persistence', { table: MATRIXCOIN_LEDGER_TABLE, ok: true, storage: 'json-local' });
  return { ok: true, storage: 'json-local', duplicate: false, ledgerEntry: normalizeLedgerRecord(ledgerPayload), wallet: normalizeWalletRecord(walletRecord) || wallet };
}

export async function appendMatrixCoinLedgerEntry(wallet, entry = {}) {
  const amountMicroEc = Math.max(0, Math.round(Number(entry.amountMicroEc || 0)));
  const idempotencyKey = String(entry.idempotencyKey || '').trim();
  const originEventId = String(entry.originEventId || idempotencyKey).trim();
  const entryType = String(entry.entryType || 'settlement').trim();

  if (!wallet?.walletId || !wallet?.identityId || !amountMicroEc || !idempotencyKey || !originEventId) {
    return { ok: false, storage: 'none', reason: 'INVALID_MATRIXCOIN_LEDGER_ENTRY' };
  }

  const normalizedEntry = { ...entry, amountMicroEc, idempotencyKey, originEventId, entryType };
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data: existing } = await supabase
      .from(MATRIXCOIN_LEDGER_TABLE)
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existing) {
      return { ok: true, storage: 'supabase', duplicate: true, ledgerEntry: normalizeLedgerRecord(existing), wallet };
    }

    const { data: previousEntries } = await supabase
      .from(MATRIXCOIN_LEDGER_TABLE)
      .select('event_seq,entry_hash')
      .eq('wallet_id', wallet.walletId)
      .order('event_seq', { ascending: false })
      .limit(1);

    const previousEntry = Array.isArray(previousEntries) ? previousEntries[0] : null;
    const eventSeq = previousEntry ? Number(previousEntry.event_seq || 0) + 1 : 0;
    const previousHash = previousEntry?.entry_hash || `${GENESIS_HASH_PREFIX}:${wallet.walletId}`;
    const recordedAt = new Date().toISOString();
    const ledgerPayload = {
      wallet_id: wallet.walletId,
      identity_id: wallet.identityId,
      event_seq: eventSeq,
      tick_id: Number(entry.tickId || 0),
      entry_type: entryType,
      amount_micro_ec: amountMicroEc,
      idempotency_key: idempotencyKey,
      origin_event_id: originEventId,
      mint_reason_code: entry.mintReasonCode || null,
      previous_hash: previousHash,
      entry_hash: hashValue({ walletId: wallet.walletId, eventSeq, previousHash, entry: normalizedEntry }),
      settlement_state: entry.settlementState || 'settled',
      metadata: entry.metadata || {},
      recorded_at: recordedAt,
    };

    const { data: inserted, error: insertError } = await supabase
      .from(MATRIXCOIN_LEDGER_TABLE)
      .insert(ledgerPayload)
      .select('*')
      .single();

    if (!insertError && inserted) {
      const amount = amountMicroEc;
      const walletPatch = {
        available_micro_ec: ['mint', 'conversion', 'settlement'].includes(entryType)
          ? Number(wallet.availableMicroEc || 0) + amount
          : Math.max(0, Number(wallet.availableMicroEc || 0) - amount),
        lifetime_minted_micro_ec: ['mint', 'conversion', 'settlement'].includes(entryType)
          ? Number(wallet.lifetimeMintedMicroEc || 0) + amount
          : Number(wallet.lifetimeMintedMicroEc || 0),
        lifetime_burned_micro_ec: entryType === 'sink'
          ? Number(wallet.lifetimeBurnedMicroEc || 0) + amount
          : Number(wallet.lifetimeBurnedMicroEc || 0),
        last_updated_at: recordedAt,
      };
      const { data: updatedWallet } = await supabase
        .from(MATRIXCOIN_WALLETS_TABLE)
        .update(walletPatch)
        .eq('wallet_id', wallet.walletId)
        .select('*')
        .single();

      await trackServerEvent('api_persistence', { table: MATRIXCOIN_LEDGER_TABLE, ok: true, storage: 'supabase' });
      return { ok: true, storage: 'supabase', duplicate: false, ledgerEntry: normalizeLedgerRecord(inserted), wallet: normalizeWalletRecord(updatedWallet) || wallet };
    }

    const { data: raceDuplicate } = await supabase
      .from(MATRIXCOIN_LEDGER_TABLE)
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (raceDuplicate) {
      return { ok: true, storage: 'supabase', duplicate: true, ledgerEntry: normalizeLedgerRecord(raceDuplicate), wallet };
    }

    await trackServerEvent('api_persistence', { table: MATRIXCOIN_LEDGER_TABLE, ok: false, storage: 'supabase', reason: insertError?.message?.slice(0, 120) || 'INSERT_FAILED' });
    if (!allowLocalJsonFallback()) return { ok: false, storage: 'none', reason: insertError?.message || 'MATRIXCOIN_LEDGER_INSERT_FAILED' };
  }

  if (!allowLocalJsonFallback()) return { ok: false, storage: 'none', reason: 'DURABLE_PERSISTENCE_NOT_CONFIGURED' };
  return appendLocalLedgerEntry(wallet, normalizedEntry);
}

async function persistLocalSettlement(wallet, ledgerEntry, settlement) {
  const current = await readJsonArray('matrixcoin-settlements.json');
  const duplicate = current.find((item) => item.idempotency_key === settlement.idempotencyKey);
  if (duplicate) return { ok: true, storage: 'json-local', duplicate: true, settlement: duplicate };

  const now = new Date().toISOString();
  const record = {
    settlement_id: hashValue({ idempotencyKey: settlement.idempotencyKey, walletId: wallet.walletId }).slice(0, 32),
    wallet_id: wallet.walletId,
    ledger_transaction_id: ledgerEntry?.transactionId || null,
    identity_id: wallet.identityId,
    node_key: MATRIXCOIN_NODE_KEY,
    idempotency_key: settlement.idempotencyKey,
    origin_event_id: settlement.originEventId,
    entropy_units: settlement.entropyUnits,
    stabilized_entropy: settlement.stabilizedEntropy,
    credit_quote: settlement.creditQuote,
    credit_micro_ec: settlement.creditMicroEc,
    route_integrity: settlement.routeIntegrity,
    settlement_state: 'settled',
    telemetry: settlement.telemetry || {},
    settled_at: now,
    created_at: now,
  };
  await writeJsonArray('matrixcoin-settlements.json', [record, ...current].slice(0, 1000));
  await trackServerEvent('api_persistence', { table: MATRIXCOIN_SETTLEMENTS_TABLE, ok: true, storage: 'json-local' });
  return { ok: true, storage: 'json-local', duplicate: false, settlement: record };
}

export async function recordMatrixCoinSettlement(authContext, settlement = {}) {
  const walletAttempt = await ensureMatrixCoinWallet(authContext, { modeScope: settlement.modeScope });
  if (!walletAttempt.ok) return walletAttempt;

  const creditQuote = Math.max(0, Number(settlement.creditQuote || settlement.quote || 0));
  const creditMicroEc = Math.max(0, Math.round(Number(settlement.creditMicroEc || creditQuote * MICRO_EC_PER_CREDIT)));
  const originEventId = String(settlement.originEventId || settlement.idempotencyKey || '').trim() || hashValue({ identity: walletAttempt.wallet.identityId, settlement }).slice(0, 48);
  const idempotencyKey = String(settlement.idempotencyKey || `${walletAttempt.wallet.identityId}:${MATRIXCOIN_NODE_KEY}:${originEventId}`).trim();

  if (!creditMicroEc) {
    return { ok: false, storage: 'none', reason: 'EMPTY_MATRIXCOIN_SETTLEMENT' };
  }

  const ledger = await appendMatrixCoinLedgerEntry(walletAttempt.wallet, {
    entryType: 'settlement',
    amountMicroEc: creditMicroEc,
    idempotencyKey,
    originEventId,
    tickId: settlement.tickId || 0,
    settlementState: 'settled',
    metadata: {
      nodeKey: MATRIXCOIN_NODE_KEY,
      modeScope: normalizeModeScope(settlement.modeScope),
      entropyUnits: Number(settlement.entropyUnits || 0),
      stabilizedEntropy: Number(settlement.stabilizedEntropy || 0),
      creditQuote,
      routeIntegrity: Number(settlement.routeIntegrity || 0),
      source: 'matrixcoinexchange_settlement',
    },
  });

  if (!ledger.ok) return ledger;

  const normalizedSettlement = {
    idempotencyKey,
    originEventId,
    entropyUnits: Number(settlement.entropyUnits || 0),
    stabilizedEntropy: Number(settlement.stabilizedEntropy || 0),
    creditQuote,
    creditMicroEc,
    routeIntegrity: Number(settlement.routeIntegrity || 0),
    telemetry: settlement.telemetry || {},
  };

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const payload = {
      wallet_id: walletAttempt.wallet.walletId,
      ledger_transaction_id: ledger.ledgerEntry?.transactionId || null,
      identity_id: walletAttempt.wallet.identityId,
      node_key: MATRIXCOIN_NODE_KEY,
      idempotency_key: idempotencyKey,
      origin_event_id: originEventId,
      entropy_units: normalizedSettlement.entropyUnits,
      stabilized_entropy: normalizedSettlement.stabilizedEntropy,
      credit_quote: normalizedSettlement.creditQuote,
      credit_micro_ec: normalizedSettlement.creditMicroEc,
      route_integrity: normalizedSettlement.routeIntegrity,
      settlement_state: 'settled',
      telemetry: normalizedSettlement.telemetry,
      settled_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(MATRIXCOIN_SETTLEMENTS_TABLE)
      .upsert(payload, { onConflict: 'idempotency_key', ignoreDuplicates: true })
      .select('*')
      .maybeSingle();

    if (!error) {
      await trackServerEvent('api_persistence', { table: MATRIXCOIN_SETTLEMENTS_TABLE, ok: true, storage: 'supabase' });
      return { ok: true, storage: 'supabase', duplicate: Boolean(ledger.duplicate), wallet: ledger.wallet, ledgerEntry: ledger.ledgerEntry, settlement: data || payload };
    }

    await trackServerEvent('api_persistence', { table: MATRIXCOIN_SETTLEMENTS_TABLE, ok: false, storage: 'supabase', reason: error.message.slice(0, 120) });
    if (!allowLocalJsonFallback()) return { ok: false, storage: 'none', reason: error.message };
  }

  const localSettlement = await persistLocalSettlement(ledger.wallet, ledger.ledgerEntry, normalizedSettlement);
  return { ...localSettlement, wallet: ledger.wallet, ledgerEntry: ledger.ledgerEntry };
}
