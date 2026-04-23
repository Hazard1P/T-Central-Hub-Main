import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getSupabaseClient } from '@/lib/supabaseClient';

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

async function insertViaSupabase(table, record) {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, reason: 'SUPABASE_NOT_CONFIGURED' };
  const { error } = await supabase.from(table).insert(record);
  if (error) return { ok: false, reason: error.message };
  return { ok: true, storage: 'supabase' };
}

function allowLocalJsonFallback() {
  return !IS_PRODUCTION && !IS_VERCEL;
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
  return { ok: true, storage: 'json-local', fallbackReason: supabaseAttempt.reason, report: payload };
}

export async function persistPlayerProgression(snapshot) {
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
    if (!error) return { ok: true, storage: 'supabase' };
  }

  if (!allowLocalJsonFallback()) {
    return { ok: false, storage: 'none', reason: 'DURABLE_PERSISTENCE_NOT_CONFIGURED' };
  }

  const current = await readJsonArray('player-progression.json');
  const next = [record, ...current.filter((item) => item.identity_id !== record.identity_id)].slice(0, 500);
  await writeJsonArray('player-progression.json', next);
  return { ok: true, storage: 'json-local' };
}

export async function loadPlayerProgression(identity = {}) {
  const identityId = String(identity.id || 'guest-server');
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.from('player_progression').select('*').eq('identity_id', identityId).maybeSingle();
    if (!error && data) {
      return {
        ok: true,
        storage: 'supabase',
        record: {
          progress: data.progress || {},
          progression: data.progression || null,
          savedAt: data.saved_at || new Date().toISOString(),
        },
      };
    }
  }

  const current = await readJsonArray('player-progression.json');
  const found = current.find((item) => item.identity_id === identityId);
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
  return { ok: true, storage: 'json-local', fallbackReason: supabaseAttempt.reason };
}
