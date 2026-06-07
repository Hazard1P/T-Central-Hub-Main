import crypto from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { buildAccountSnapshot, defaultProgressState } from '@/lib/accountProgression';
import { trackServerEvent } from '@/lib/server/vercelTelemetry';

const DATA_DIR = path.join(process.cwd(), 'data');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readJsonArray(filename) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeJsonArray(filename, records) {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  await writeFile(filePath, JSON.stringify(records, null, 2), 'utf8');
}

async function appendJsonRecord(filename, record) {
  const current = await readJsonArray(filename);
  current.unshift(record);
  await writeJsonArray(filename, current.slice(0, 500));
  return record;
}


function createLedgerEventId({ identityId, eventType, savedAt, progress } = {}) {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ identityId, eventType, savedAt, progress }))
    .digest('hex')
    .slice(0, 32);
  return `${String(identityId || 'guest-server')}:${String(eventType || 'ACCOUNT_EVENT')}:${hash}`;
}

function buildPlayerAccountLedgerEvent(snapshot, eventType = 'PROGRESSION_SNAPSHOT_SAVED', extra = {}) {
  return {
    event_id: createLedgerEventId({
      identityId: snapshot.identity.id,
      eventType,
      savedAt: snapshot.savedAt,
      progress: snapshot.progress,
    }),
    identity_id: snapshot.identity.id,
    display_name: snapshot.identity.displayName,
    identity_kind: snapshot.identity.kind,
    authenticated: snapshot.identity.authenticated,
    event_type: eventType,
    progress: snapshot.progress,
    progression: snapshot.progression,
    metadata: extra,
    created_at: snapshot.savedAt || new Date().toISOString(),
  };
}

async function persistPlayerAccountLedgerEvent(snapshot, eventType = 'PROGRESSION_SNAPSHOT_SAVED', extra = {}) {
  const event = buildPlayerAccountLedgerEvent(snapshot, eventType, extra);
  const supabase = getSupabaseClient();

  if (supabase) {
    const { error } = await supabase.from('player_account_ledger').upsert(event, { onConflict: 'event_id' });
    if (!error) {
      await trackServerEvent('api_account_ledger', { ok: true, storage: 'supabase', eventType });
      return { ok: true, storage: 'supabase', event };
    }
    await trackServerEvent('api_account_ledger', { ok: false, storage: 'supabase', eventType, reason: error.message.slice(0, 120) });
  }

  if (!allowLocalJsonFallback()) {
    return { ok: false, storage: 'none', reason: 'ACCOUNT_LEDGER_PERSISTENCE_NOT_CONFIGURED', event };
  }

  const current = await readJsonArray('player-account-ledger.json');
  const next = [event, ...current.filter((item) => item.event_id !== event.event_id)].slice(0, 1000);
  await writeJsonArray('player-account-ledger.json', next);
  await trackServerEvent('api_account_ledger', { ok: true, storage: 'json-local', eventType });
  return { ok: true, storage: 'json-local', event };
}

async function insertViaSupabase(table, record) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    await trackServerEvent('api_persistence', { table, ok: false, storage: 'none', reason: 'SUPABASE_NOT_CONFIGURED' });
    return { ok: false, reason: 'SUPABASE_NOT_CONFIGURED' };
  }

  const { error } = await supabase.from(table).insert(record);
  if (error) {
    await trackServerEvent('api_persistence', { table, ok: false, storage: 'supabase', reason: error.message.slice(0, 120) });
    return { ok: false, reason: error.message };
  }

  await trackServerEvent('api_persistence', { table, ok: true, storage: 'supabase' });
  return { ok: true, storage: 'supabase' };
}

function allowLocalJsonFallback() {
  return !IS_PRODUCTION && !IS_VERCEL;
}

function legacyIdentityIds(identityId) {
  const normalized = String(identityId || 'guest-server');
  if (normalized.startsWith('steam:')) return [normalized.slice('steam:'.length)];
  return [];
}

function classifyReportSeverity(report = {}) {
  const content = `${report.reason || ''} ${report.evidence || ''}`.toLowerCase();
  if (/(threat|dox|hate|stalk|hack|ddos|exploit|cheat|ban evasion)/.test(content)) return { severity: 'high', severityLabel: 'Escalated' };
  if (/(abuse|grief|harass|spam|toxic|slur)/.test(content)) return { severity: 'medium', severityLabel: 'Priority review' };
  return { severity: 'low', severityLabel: 'Standard review' };
}

export async function persistContactSubmission(record) {
  const supabaseAttempt = await insertViaSupabase('contact_submissions', record);
  if (supabaseAttempt.ok) return { ok: true, storage: 'supabase' };

  if (!allowLocalJsonFallback()) {
    return { ok: false, storage: 'none', reason: supabaseAttempt.reason || 'DURABLE_PERSISTENCE_NOT_CONFIGURED' };
  }

  await appendJsonRecord('contact-submissions.json', record);
  await trackServerEvent('api_persistence', { table: 'contact_submissions', ok: true, storage: 'json-local' });
  return { ok: true, storage: 'json-local', fallbackReason: supabaseAttempt.reason };
}

export async function persistPlayerReport(record) {
  const moderation = classifyReportSeverity(record);
  const payload = {
    ...record,
    moderationStatus: 'received',
    statusLabel: 'Received',
    moderationStage: moderation.severity === 'high' ? 'escalation-queue' : 'review-queue',
    severity: moderation.severity,
    severityLabel: moderation.severityLabel,
    reviewedAt: null,
    actionTaken: null,
  };

  const supabaseAttempt = await insertViaSupabase('player_reports', payload);
  if (supabaseAttempt.ok) return { ok: true, storage: 'supabase', report: payload };

  if (!allowLocalJsonFallback()) {
    return { ok: false, storage: 'none', reason: supabaseAttempt.reason || 'DURABLE_PERSISTENCE_NOT_CONFIGURED' };
  }

  await appendJsonRecord('player-reports.json', payload);
  await trackServerEvent('api_persistence', { table: 'player_reports', ok: true, storage: 'json-local' });
  return { ok: true, storage: 'json-local', fallbackReason: supabaseAttempt.reason, report: payload };
}

export async function persistPlayerProgression(snapshot, { eventType = 'PROGRESSION_SNAPSHOT_SAVED', ledgerMetadata = {} } = {}) {
  const record = {
    identity_id: snapshot.identity.id,
    display_name: snapshot.identity.displayName,
    identity_kind: snapshot.identity.kind,
    authenticated: snapshot.identity.authenticated,
    progress: snapshot.progress,
    progression: snapshot.progression,
    saved_at: snapshot.savedAt,
  };

  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from('player_progression').upsert(record, { onConflict: 'identity_id' });
    if (!error) {
      const ledger = await persistPlayerAccountLedgerEvent(snapshot, eventType, ledgerMetadata);
      return { ok: true, storage: 'supabase', ledger };
    }
  }

  if (!allowLocalJsonFallback()) {
    return { ok: false, storage: 'none', reason: 'DURABLE_PERSISTENCE_NOT_CONFIGURED' };
  }

  const current = await readJsonArray('player-progression.json');
  const next = [record, ...current.filter((item) => item.identity_id !== record.identity_id)].slice(0, 500);
  await writeJsonArray('player-progression.json', next);
  const ledger = await persistPlayerAccountLedgerEvent(snapshot, eventType, ledgerMetadata);
  await trackServerEvent('api_persistence', { table: 'player_progression', ok: true, storage: 'json-local' });
  return { ok: true, storage: 'json-local', ledger };
}

export async function loadPlayerProgression(identity = {}) {
  const identityId = String(identity.id || 'guest-server');
  const supabase = getSupabaseClient();
  const candidateIds = [identityId, ...legacyIdentityIds(identityId)];
  if (supabase) {
    const { data, error } = await supabase.from('player_progression').select('*').in('identity_id', candidateIds).order('saved_at', { ascending: false }).limit(1);
    const found = !error && Array.isArray(data) ? data[0] : null;
    if (found) {
      return {
        ok: true,
        storage: 'supabase',
        record: {
          progress: found.progress || {},
          progression: found.progression || null,
          savedAt: found.saved_at || new Date().toISOString(),
        },
      };
    }
  }

  const current = await readJsonArray('player-progression.json');
  const found = current.find((item) => candidateIds.includes(item.identity_id));
  if (found) {
    return {
      ok: true,
      storage: 'json-local',
      record: {
        progress: found.progress || {},
        progression: found.progression || null,
        savedAt: found.saved_at || new Date().toISOString(),
      },
    };
  }

  return { ok: false, storage: 'none', record: null };
}


export async function ensurePlayerAccountForLogin({ provider, accountId, displayName, authenticated = true, metadata = {} } = {}) {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  const normalizedAccountId = String(accountId || '').trim();

  if (!normalizedProvider || !normalizedAccountId) {
    return { ok: false, storage: 'none', reason: 'ACCOUNT_ID_REQUIRED' };
  }

  const identity = {
    id: `${normalizedProvider}:${normalizedAccountId}`,
    displayName: displayName || `${normalizedProvider[0]?.toUpperCase() || 'A'}${normalizedProvider.slice(1)} Pilot`,
    kind: normalizedProvider,
    authenticated: Boolean(authenticated),
  };

  const loaded = await loadPlayerProgression(identity);
  if (loaded?.record) {
    const snapshot = buildAccountSnapshot({
      identity,
      progress: loaded.record.progress || defaultProgressState(),
      savedAt: loaded.record.savedAt,
    });
    const ledger = await persistPlayerAccountLedgerEvent(snapshot, 'ACCOUNT_LOGIN', { provider: normalizedProvider, ...metadata });
    return { ok: true, storage: loaded.storage, created: false, identity, ledger };
  }

  const snapshot = buildAccountSnapshot({ identity, progress: defaultProgressState() });
  const persisted = await persistPlayerProgression(snapshot, {
    eventType: 'ACCOUNT_CREATED',
    ledgerMetadata: { provider: normalizedProvider, firstLogin: true, ...metadata },
  });

  return {
    ok: persisted.ok,
    storage: persisted.storage,
    created: true,
    identity,
    reason: persisted.reason || null,
    ledger: persisted.ledger || null,
  };
}

export async function getModerationSummary({ reporterId = null } = {}) {
  const summarize = (records = []) => {
    const recent = records.slice(0, 6);
    const queue = {
      totalOpen: records.filter((item) => item.moderationStatus !== 'resolved').length,
      escalated: records.filter((item) => item.severity === 'high').length,
      underReview: records.filter((item) => ['received', 'reviewing'].includes(item.moderationStatus)).length,
      resolved: records.filter((item) => item.moderationStatus === 'resolved').length,
    };
    return { queue, recentReports: recent };
  };

  const supabase = getSupabaseClient();
  if (supabase && reporterId) {
    const { data, error } = await supabase
      .from('player_reports')
      .select('*')
      .contains('reporter', { steamid: String(reporterId) })
      .order('createdAt', { ascending: false })
      .limit(12);
    if (!error && Array.isArray(data)) return summarize(data);
  }

  const current = await readJsonArray('player-reports.json');
  const filtered = reporterId ? current.filter((item) => String(item?.reporter?.steamid || '') === String(reporterId)) : current;
  return summarize(filtered);
}

export async function persistDysonMeterEvent(record) {
  const payload = {
    ...record,
    generated_at: record.generated_at || new Date().toISOString(),
  };

  const supabaseAttempt = await insertViaSupabase('dyson_meter_events', payload);
  if (supabaseAttempt.ok) return { ok: true, storage: 'supabase' };

  if (!allowLocalJsonFallback()) {
    return { ok: false, storage: 'none', reason: supabaseAttempt.reason || 'DURABLE_PERSISTENCE_NOT_CONFIGURED' };
  }

  await appendJsonRecord('dyson-meter-events.json', payload);
  await trackServerEvent('api_persistence', { table: 'dyson_meter_events', ok: true, storage: 'json-local' });
  return { ok: true, storage: 'json-local', fallbackReason: supabaseAttempt.reason };
}

export async function persistHubPost(record) {
  const supabaseAttempt = await insertViaSupabase('hub_posts', record);
  if (supabaseAttempt.ok) return { ok: true, storage: 'supabase' };

  if (!allowLocalJsonFallback()) {
    return { ok: false, storage: 'none', reason: supabaseAttempt.reason || 'DURABLE_PERSISTENCE_NOT_CONFIGURED' };
  }

  await appendJsonRecord('hub-posts.json', record);
  await trackServerEvent('api_persistence', { table: 'hub_posts', ok: true, storage: 'json-local' });
  return { ok: true, storage: 'json-local', fallbackReason: supabaseAttempt.reason };
}

export async function listHubPosts() {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('hub_posts')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(40);
    if (!error && Array.isArray(data)) return data;
  }

  return readJsonArray('hub-posts.json');
}

export async function persistLaunchRecord(record) {
  const payload = {
    ...record,
    createdAt: record.createdAt || new Date().toISOString(),
  };

  const supabaseAttempt = await insertViaSupabase('launch_records', payload);
  if (supabaseAttempt.ok) return { ok: true, storage: 'supabase' };

  if (!allowLocalJsonFallback()) {
    return { ok: false, storage: 'none', reason: supabaseAttempt.reason || 'DURABLE_PERSISTENCE_NOT_CONFIGURED' };
  }

  await appendJsonRecord('launch-records.json', payload);
  await trackServerEvent('api_persistence', { table: 'launch_records', ok: true, storage: 'json-local' });
  return { ok: true, storage: 'json-local', fallbackReason: supabaseAttempt.reason };
}
