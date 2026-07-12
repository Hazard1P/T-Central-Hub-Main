import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { buildAccountSnapshot, defaultProgressState } from '@/lib/accountProgression';
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin';
import { trackServerEvent } from '@/lib/server/vercelTelemetry';

const DATA_DIR = path.join(process.cwd(), 'data');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
const PLAYER_ACCOUNT_LEDGER_TABLE = 'player_account_ledger';
const PROGRESSION_SNAPSHOT_EVENT = 'PROGRESSION_SNAPSHOT_SAVED';
const STEAM_FIRST_LOGIN_EVENT = 'STEAM_FIRST_LOGIN_BOOTSTRAPPED';

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

async function appendJsonLedgerRecord(record) {
  const current = await readJsonArray('player-account-ledger.json');
  if (current.some((item) => item.idempotency_key === record.idempotency_key)) {
    return { ok: true, storage: 'json-local', duplicate: true };
  }
  current.unshift(record);
  await writeJsonArray('player-account-ledger.json', current.slice(0, 1000));
  await trackServerEvent('api_persistence', { table: PLAYER_ACCOUNT_LEDGER_TABLE, ok: true, storage: 'json-local' });
  return { ok: true, storage: 'json-local', duplicate: false };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashLedgerContent(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function buildProgressDelta(progress = {}) {
  return {
    routeTrips: Number(progress.routeTrips || 0),
    seedCount: Number(progress.seedCount || 0),
    entropyMined: Number(progress.entropyMined || 0),
    entropyResolved: Number(progress.entropyResolved || 0),
    credits: Number(progress.credits || 0),
    multiplayerJumped: Boolean(progress.multiplayerJumped),
    visitedNodes: Array.isArray(progress.visitedNodes) ? progress.visitedNodes : [],
  };
}

async function insertViaSupabase(table, record) {
  const supabase = getSupabaseAdmin() || getSupabaseClient();
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

async function insertLedgerViaSupabase(record) {
  const supabase = getSupabaseAdmin() || getSupabaseClient();
  if (!supabase) {
    await trackServerEvent('api_persistence', { table: PLAYER_ACCOUNT_LEDGER_TABLE, ok: false, storage: 'none', reason: 'SUPABASE_NOT_CONFIGURED' });
    return { ok: false, reason: 'SUPABASE_NOT_CONFIGURED' };
  }

  const { error } = await supabase
    .from(PLAYER_ACCOUNT_LEDGER_TABLE)
    .upsert(record, { onConflict: 'idempotency_key', ignoreDuplicates: true });

  if (error) {
    await trackServerEvent('api_persistence', { table: PLAYER_ACCOUNT_LEDGER_TABLE, ok: false, storage: 'supabase', reason: error.message.slice(0, 120) });
    return { ok: false, reason: error.message };
  }

  await trackServerEvent('api_persistence', { table: PLAYER_ACCOUNT_LEDGER_TABLE, ok: true, storage: 'supabase' });
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

function normalizeSteamAccountProfile(steamUser = {}) {
  const steamId = String(steamUser?.steamid || '').trim();
  if (!steamId) return null;

  return {
    account_key: steamId,
    steam_id: steamId,
    provider: 'steam',
    display_name: String(steamUser?.personaname || 'Steam Pilot').slice(0, 160),
    profile_url: steamUser?.profileurl ? String(steamUser.profileurl).slice(0, 512) : null,
    avatar_url: steamUser?.avatar ? String(steamUser.avatar).slice(0, 512) : null,
  };
}

function buildSteamAccountSnapshot(profile, now = new Date().toISOString()) {
  return buildAccountSnapshot({
    identity: {
      id: profile.account_key,
      displayName: profile.display_name,
      kind: 'steam',
      authenticated: true,
    },
    steamUser: {
      steamid: profile.steam_id,
      personaname: profile.display_name,
      profileurl: profile.profile_url,
      avatar: profile.avatar_url,
    },
    progress: defaultProgressState(),
    savedAt: now,
  });
}

async function upsertLocalPlayerAccount(profile, now) {
  const current = await readJsonArray('player-accounts.json');
  const previous = current.find((item) => item.account_key === profile.account_key || item.steam_id === profile.steam_id);
  const record = {
    ...(previous || {}),
    ...profile,
    created_at: previous?.created_at || now,
    updated_at: now,
    last_login_at: now,
  };
  const next = [record, ...current.filter((item) => item.account_key !== profile.account_key && item.steam_id !== profile.steam_id)].slice(0, 500);
  await writeJsonArray('player-accounts.json', next);
  return { record, created: !previous };
}

export async function ensurePlayerAccountLedger({ steamUser } = {}) {
  const profile = normalizeSteamAccountProfile(steamUser);
  if (!profile) {
    return { ok: false, storage: 'none', reason: 'MISSING_STEAM_ID' };
  }

  const now = new Date().toISOString();
  const identity = { id: profile.account_key, displayName: profile.display_name, kind: 'steam', authenticated: true };

  try {
    const supabase = getSupabaseAdmin() || getSupabaseClient();
    if (supabase) {
      const { data: existingAccount, error: accountLookupError } = await supabase
        .from('player_accounts')
        .select('account_key, created_at')
        .eq('account_key', profile.account_key)
        .maybeSingle();

      if (accountLookupError) throw accountLookupError;

      const accountRecord = {
        ...profile,
        created_at: existingAccount?.created_at || now,
        updated_at: now,
        last_login_at: now,
      };
      const { error: accountUpsertError } = await supabase
        .from('player_accounts')
        .upsert(accountRecord, { onConflict: 'account_key' });
      if (accountUpsertError) throw accountUpsertError;

      const loadedProgression = await loadPlayerProgression(identity);
      let progressionInitialized = false;
      if (!loadedProgression?.record) {
        const snapshot = buildSteamAccountSnapshot(profile, now);
        const progressionWrite = await persistPlayerProgression(snapshot);
        progressionInitialized = Boolean(progressionWrite.ok);
      }

      const created = !existingAccount;
      let ledgerAppended = false;
      if (created) {
        const ledgerWrite = await persistPlayerAccountLedgerEvent({
          identityId: profile.account_key,
          accountKey: profile.account_key,
          eventType: 'ACCOUNT_CREATED',
          eventPayload: {
            provider: 'steam',
            steam_id: profile.steam_id,
            display_name: profile.display_name,
          },
          metadata: {
            provider: 'steam',
            steam_id: profile.steam_id,
            display_name: profile.display_name,
          },
          savedAt: now,
          idempotencyKey: `${profile.account_key}:ACCOUNT_CREATED`,
        });
        ledgerAppended = Boolean(ledgerWrite.ok);
      }

      await trackServerEvent('player_account_bootstrap', {
        ok: true,
        storage: 'supabase',
        created,
        progressionInitialized,
        ledgerAppended,
      });

      return {
        ok: true,
        storage: 'supabase',
        created,
        progressionInitialized,
        ledgerAppended,
      };
    }

    if (!allowLocalJsonFallback()) {
      await trackServerEvent('player_account_bootstrap', { ok: false, storage: 'none', reason: 'DURABLE_PERSISTENCE_NOT_CONFIGURED' });
      return {
        ok: false,
        storage: 'none',
        reason: 'DURABLE_PERSISTENCE_NOT_CONFIGURED',
      };
    }

    const { created } = await upsertLocalPlayerAccount(profile, now);
    const loadedProgression = await loadPlayerProgression(identity);
    let progressionInitialized = false;
    if (!loadedProgression?.record) {
      const snapshot = buildSteamAccountSnapshot(profile, now);
      const progressionWrite = await persistPlayerProgression(snapshot);
      progressionInitialized = Boolean(progressionWrite.ok);
    }

    let ledgerAppended = false;
    if (created) {
      const ledgerWrite = await persistPlayerAccountLedgerEvent({
        identityId: profile.account_key,
        accountKey: profile.account_key,
        eventType: 'ACCOUNT_CREATED',
        eventPayload: {
          provider: 'steam',
          steam_id: profile.steam_id,
          display_name: profile.display_name,
        },
        metadata: {
          provider: 'steam',
          steam_id: profile.steam_id,
          display_name: profile.display_name,
        },
        savedAt: now,
        idempotencyKey: `${profile.account_key}:ACCOUNT_CREATED`,
      });
      ledgerAppended = Boolean(ledgerWrite.ok);
    }

    await trackServerEvent('player_account_bootstrap', {
      ok: true,
      storage: 'json-local',
      created,
      progressionInitialized,
      ledgerAppended,
    });

    return {
      ok: true,
      storage: 'json-local',
      created,
      progressionInitialized,
      ledgerAppended,
    };
  } catch (error) {
    await trackServerEvent('player_account_bootstrap', {
      ok: false,
      storage: 'unknown',
      reason: String(error?.message || 'ACCOUNT_BOOTSTRAP_FAILED').slice(0, 120),
    });

    return {
      ok: false,
      storage: 'unknown',
      reason: 'ACCOUNT_BOOTSTRAP_FAILED',
    };
  }
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

export async function persistPlayerAccountLedgerEvent({
  identityId,
  accountKey = null,
  eventType,
  eventPayload = null,
  progressDelta = null,
  progress = null,
  progression = null,
  savedAt = null,
  metadata = null,
  idempotencyKey = null,
} = {}) {
  const identity_id = String(identityId || '').trim();
  const event_type = String(eventType || '').trim();
  const account_key = accountKey ? String(accountKey).trim() : null;
  const saved_at = savedAt || new Date().toISOString();

  if (!identity_id || !event_type) {
    return { ok: false, storage: 'none', reason: 'INVALID_PLAYER_ACCOUNT_LEDGER_EVENT' };
  }

  const contentHash = hashLedgerContent({
    identity_id,
    event_type,
    account_key,
    event_payload: eventPayload || {},
    progress_delta: progressDelta,
    progress,
    progression,
    metadata,
  });

  const record = {
    identity_id,
    event_type,
    account_key,
    event_payload: eventPayload || {},
    progress_delta: progressDelta,
    progress,
    progression,
    metadata,
    saved_at,
    created_at: saved_at,
    idempotency_key: idempotencyKey || `${identity_id}:${event_type}:${contentHash}`,
    content_hash: contentHash,
  };

  const supabaseAttempt = await insertLedgerViaSupabase(record);
  if (supabaseAttempt.ok) return supabaseAttempt;

  if (!allowLocalJsonFallback()) {
    return { ok: false, storage: 'none', reason: supabaseAttempt.reason || 'DURABLE_PERSISTENCE_NOT_CONFIGURED' };
  }

  return appendJsonLedgerRecord(record);
}

export async function persistSteamFirstLoginEvent(steamUser = {}) {
  const steamid = String(steamUser?.steamid || '').trim();
  if (!steamid) {
    return { ok: false, storage: 'none', reason: 'STEAM_ID_REQUIRED' };
  }

  return persistPlayerAccountLedgerEvent({
    identityId: steamid,
    accountKey: steamid,
    eventType: STEAM_FIRST_LOGIN_EVENT,
    eventPayload: {
      provider: 'steam',
      steam_id: steamid,
      displayName: steamUser.personaname || 'Steam Pilot',
    },
    progressDelta: { steamLinked: true },
    progress: null,
    progression: null,
    metadata: {
      displayName: steamUser.personaname || 'Steam Pilot',
      profileUrl: steamUser.profileurl || null,
      avatar: steamUser.avatar || null,
    },
    idempotencyKey: `${steamid}:${STEAM_FIRST_LOGIN_EVENT}`,
  });
}

export async function persistPlayerProgression(snapshot, { eventType = PROGRESSION_SNAPSHOT_EVENT, ledgerMetadata = null, idempotencyKey = null } = {}) {
  const record = {
    identity_id: snapshot.identity.id,
    display_name: snapshot.identity.displayName,
    identity_kind: snapshot.identity.kind,
    authenticated: snapshot.identity.authenticated,
    progress: snapshot.progress,
    progression: snapshot.progression,
    saved_at: snapshot.savedAt,
  };

  const ledgerEvent = {
    identityId: record.identity_id,
    accountKey: record.identity_id,
    eventType,
    eventPayload: ledgerMetadata || {},
    progressDelta: buildProgressDelta(snapshot.progress),
    progress: snapshot.progress,
    progression: snapshot.progression,
    metadata: ledgerMetadata,
    savedAt: snapshot.savedAt,
    idempotencyKey,
  };

  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from('player_progression').upsert(record, { onConflict: 'identity_id' });
    if (!error) {
      const ledger = await persistPlayerAccountLedgerEvent(ledgerEvent);
      return { ok: true, storage: 'supabase', ledger };
    }
  }

  if (!allowLocalJsonFallback()) {
    return { ok: false, storage: 'none', reason: 'DURABLE_PERSISTENCE_NOT_CONFIGURED' };
  }

  const current = await readJsonArray('player-progression.json');
  const next = [record, ...current.filter((item) => item.identity_id !== record.identity_id)].slice(0, 500);
  await writeJsonArray('player-progression.json', next);
  await trackServerEvent('api_persistence', { table: 'player_progression', ok: true, storage: 'json-local' });
  const ledger = await persistPlayerAccountLedgerEvent(ledgerEvent);
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
    const ledger = await persistPlayerAccountLedgerEvent({
      identityId: identity.id,
      accountKey: identity.id,
      eventType: 'ACCOUNT_LOGIN',
      eventPayload: { provider: normalizedProvider, ...metadata },
      progressDelta: buildProgressDelta(snapshot.progress),
      progress: snapshot.progress,
      progression: snapshot.progression,
      metadata: { provider: normalizedProvider, ...metadata },
      savedAt: snapshot.savedAt,
    });
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

export function getHubPostStorageReadiness() {
  const supabase = getSupabaseAdmin() || getSupabaseClient();
  if (supabase) return { storageConfigured: true, storage: 'supabase' };
  if (allowLocalJsonFallback()) return { storageConfigured: true, storage: 'json-local' };
  return { storageConfigured: false, storage: 'none' };
}

export async function listHubPosts() {
  const supabase = getSupabaseAdmin() || getSupabaseClient();
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
