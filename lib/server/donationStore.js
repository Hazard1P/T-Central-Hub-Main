import { getSupabaseAdmin, hasSupabaseAdmin } from '@/lib/server/supabaseAdmin';

const DONATIONS_TABLE = 'tcentral_donations';

function nowIso() {
  return new Date().toISOString();
}

function sanitizeAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '0.00';
  return amount.toFixed(2);
}

function toLedgerRecord(row = {}) {
  return {
    id: row.id || null,
    orderId: row.order_id,
    steamid: row.steamid,
    personaname: row.personaname || null,
    amount: sanitizeAmount(row.amount),
    currency: String(row.currency || 'USD').toUpperCase(),
    anchorSlug: row.anchor_slug || 'deep_blackhole',
    solarSystemKey: row.solar_system_key || 'solar_system',
    status: row.status || 'CREATED',
    captureId: row.capture_id || null,
    paypalStatus: row.paypal_status || null,
    captureStatus: row.capture_status || null,
    captureAmount: row.capture_amount ? sanitizeAmount(row.capture_amount) : null,
    captureCurrency: row.capture_currency || null,
    captureMetadata: row.capture_metadata || null,
    captureIdempotencyKey: row.capture_idempotency_key || null,
    createdAt: row.created_at || nowIso(),
    updatedAt: row.updated_at || row.created_at || nowIso(),
    capturedAt: row.captured_at || null,
  };
}

function summarizeDonationRows(rows = []) {
  const ordered = [...rows].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  const confirmed = ordered.filter((entry) => entry.status === 'CONFIRMED');
  const totalAmount = confirmed.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  return {
    total: ordered.length,
    confirmed: confirmed.length,
    totalAmount: totalAmount.toFixed(2),
    latest: ordered[0] || null,
  };
}

export function hasDonationStore() {
  return hasSupabaseAdmin();
}

export async function createDonationIntentRow({ steamUser, amount, currency, anchorSlug, solarSystemKey, orderId }) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Supabase admin is not configured for donations');

  const payload = {
    order_id: orderId,
    steamid: String(steamUser.steamid),
    personaname: steamUser.personaname || null,
    amount: sanitizeAmount(amount),
    currency: String(currency || 'USD').toUpperCase(),
    anchor_slug: anchorSlug || 'deep_blackhole',
    solar_system_key: solarSystemKey || 'solar_system',
    status: 'CREATED',
  };

  const { data, error } = await admin.from(DONATIONS_TABLE).upsert(payload, { onConflict: 'order_id' }).select('*').single();
  if (error) throw new Error(`Unable to persist donation intent: ${error.message}`);
  return toLedgerRecord(data);
}

export async function confirmDonationCapture({
  orderId,
  steamUser,
  capture,
  captureOrder,
  idempotencyKey,
}) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Supabase admin is not configured for donations');

  const normalizedOrderId = String(orderId || '').trim();
  const normalizedIdempotencyKey = String(idempotencyKey || '').trim().slice(0, 128);

  const { data: existing, error: existingError } = await admin
    .from(DONATIONS_TABLE)
    .select('*')
    .eq('order_id', normalizedOrderId)
    .eq('steamid', String(steamUser.steamid))
    .maybeSingle();

  if (existingError) throw new Error(`Unable to load donation order: ${existingError.message}`);
  if (!existing) throw new Error('Donation intent not found for this user/order');

  const existingRecord = toLedgerRecord(existing);
  if (existingRecord.status === 'CONFIRMED') {
    if (normalizedIdempotencyKey && existingRecord.captureIdempotencyKey && existingRecord.captureIdempotencyKey !== normalizedIdempotencyKey) {
      throw new Error('Order is already confirmed with a different idempotency key');
    }
    return { record: existingRecord, idempotentReplay: true };
  }

  if (normalizedIdempotencyKey && existing.capture_idempotency_key && existing.capture_idempotency_key !== normalizedIdempotencyKey) {
    throw new Error('Idempotency key conflict for capture confirmation');
  }

  const captureStatus = capture?.status || captureOrder?.status || null;
  const finalStatus = capture?.status === 'COMPLETED' ? 'CONFIRMED' : existing.status || 'CREATED';
  const captureAmount = capture?.amount?.value ? sanitizeAmount(capture.amount.value) : sanitizeAmount(existing.amount);
  const captureCurrency = String(capture?.amount?.currency_code || existing.currency || 'USD').toUpperCase();
  const capturedAt = capture?.create_time || nowIso();

  const updatePayload = {
    status: finalStatus,
    paypal_status: captureOrder?.status || null,
    capture_status: captureStatus,
    capture_id: capture?.id || existing.capture_id || null,
    capture_amount: captureAmount,
    capture_currency: captureCurrency,
    capture_metadata: {
      captureOrder,
      capture,
    },
    capture_idempotency_key: normalizedIdempotencyKey || existing.capture_idempotency_key || null,
    captured_at: finalStatus === 'CONFIRMED' ? capturedAt : existing.captured_at,
    updated_at: nowIso(),
  };

  const { data, error } = await admin
    .from(DONATIONS_TABLE)
    .update(updatePayload)
    .eq('id', existing.id)
    .eq('status', existing.status)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Unable to confirm donation capture: ${error.message}`);
  }

  return { record: toLedgerRecord(data), idempotentReplay: false };
}

export async function getDonationsBySteamId(steamid) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Supabase admin is not configured for donations');

  const { data, error } = await admin
    .from(DONATIONS_TABLE)
    .select('*')
    .eq('steamid', String(steamid))
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) throw new Error(`Unable to load donations: ${error.message}`);

  const ledger = (data || []).map(toLedgerRecord);
  return {
    ledger,
    summary: summarizeDonationRows(ledger),
  };
}
