import { getSupabaseAdmin, hasSupabaseAdmin } from '@/lib/server/supabaseAdmin';

const SUPPORT_LEDGER_TABLE = 'tcentral_support_ledger';

function nowIso() {
  return new Date().toISOString();
}

function normalizeIdentifierType(value, fallback = 'subscription') {
  const normalized = String(value || fallback).trim().toLowerCase();
  return ['subscription', 'order', 'capture'].includes(normalized) ? normalized : fallback;
}

function normalizeStatus(value, fallback = 'VERIFIED') {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized || fallback;
}

function normalizeProvider(value) {
  return String(value || 'paypal').trim().toLowerCase() || 'paypal';
}

function toSupportLedgerRecord(row = {}) {
  const identifierType = normalizeIdentifierType(row.identifier_type);
  const identifier = row.identifier || row.subscription_id || row.capture_id || row.order_id || null;
  return {
    id: row.id || null,
    provider: normalizeProvider(row.provider),
    identifierType,
    identifier,
    orderId: row.order_id || (identifierType === 'order' ? identifier : null),
    captureId: row.capture_id || (identifierType === 'capture' ? identifier : null),
    subscriptionId: row.subscription_id || (identifierType === 'subscription' ? identifier : null),
    steamid: row.steamid ? String(row.steamid) : null,
    personaname: row.personaname || null,
    planId: row.plan_id || null,
    status: normalizeStatus(row.status, 'VERIFIED'),
    paypalEventType: row.paypal_event_type || null,
    lastEventId: row.last_event_id || null,
    verification: row.verification || null,
    metadata: row.metadata || null,
    createdAt: row.created_at || nowIso(),
    updatedAt: row.updated_at || row.created_at || nowIso(),
    linkedAt: row.linked_at || null,
  };
}

function makePayload(record = {}) {
  const identifierType = normalizeIdentifierType(record.identifierType);
  const identifier = String(record.identifier || record.subscriptionId || record.captureId || record.orderId || '').trim();
  if (!identifier) {
    throw new Error('Missing support ledger identifier');
  }

  return {
    provider: normalizeProvider(record.provider),
    identifier_type: identifierType,
    identifier,
    order_id: record.orderId || (identifierType === 'order' ? identifier : null),
    capture_id: record.captureId || (identifierType === 'capture' ? identifier : null),
    subscription_id: record.subscriptionId || (identifierType === 'subscription' ? identifier : null),
    steamid: record.steamid ? String(record.steamid) : null,
    personaname: record.personaname || null,
    plan_id: record.planId || null,
    status: normalizeStatus(record.status || record.verification?.state, 'VERIFIED'),
    paypal_event_type: record.paypalEventType || null,
    last_event_id: record.lastEventId || record.eventId || null,
    verification: record.verification || null,
    metadata: record.metadata || null,
    linked_at: record.linkedAt || null,
    updated_at: nowIso(),
  };
}

export function hasSupportLedgerStore() {
  return hasSupabaseAdmin();
}

export async function upsertSupportLedgerRecord(record = {}) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Supabase admin is not configured for support ledger');

  const payload = makePayload(record);
  const { data, error } = await admin
    .from(SUPPORT_LEDGER_TABLE)
    .upsert(payload, { onConflict: 'provider,identifier_type,identifier' })
    .select('*')
    .single();

  if (error) throw new Error(`Unable to persist support ledger: ${error.message}`);
  return toSupportLedgerRecord(data);
}

export async function findSupportLedgerRecord({ provider = 'paypal', identifierType, identifier, steamid } = {}) {
  const admin = getSupabaseAdmin();
  if (!admin || !identifierType || !identifier) return null;

  let query = admin
    .from(SUPPORT_LEDGER_TABLE)
    .select('*')
    .eq('provider', normalizeProvider(provider))
    .eq('identifier_type', normalizeIdentifierType(identifierType))
    .eq('identifier', String(identifier));

  if (steamid) {
    query = query.eq('steamid', String(steamid));
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Unable to read support ledger: ${error.message}`);
  return data ? toSupportLedgerRecord(data) : null;
}

export async function getLatestSupportLedgerRecordBySteamId(steamid) {
  const admin = getSupabaseAdmin();
  if (!admin || !steamid) return null;

  const { data, error } = await admin
    .from(SUPPORT_LEDGER_TABLE)
    .select('*')
    .eq('provider', 'paypal')
    .eq('steamid', String(steamid))
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Unable to read support ledger: ${error.message}`);
  return data ? toSupportLedgerRecord(data) : null;
}
