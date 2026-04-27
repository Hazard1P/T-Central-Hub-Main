import { SESSION_MODES, normalizeSessionMode } from '@/lib/sessionModeEngine';

const SCHEMA_KEYS = Object.freeze(['shipBuild', 'upgrades', 'utility', 'engineering', 'continuityHealth']);
const MAX_STALE_WINDOW = 1;

function getContinuityStore() {
  if (!globalThis.__TCENTRAL_MODE_BRIDGE_CONTINUITY__) {
    globalThis.__TCENTRAL_MODE_BRIDGE_CONTINUITY__ = new Map();
  }
  return globalThis.__TCENTRAL_MODE_BRIDGE_CONTINUITY__;
}

function toFiniteNumber(value, fallback = 0, min = -Infinity, max = Infinity) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function toObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function sanitizeBlock(block) {
  const source = toObject(block);
  const output = {};
  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      output[key] = value.slice(0, 128);
      continue;
    }
    if (value && typeof value === 'object') {
      output[key] = { ...value };
      continue;
    }
    output[key] = value;
  }
  return output;
}

export function rehydrateModeBridgeState(value = {}) {
  const source = toObject(value);
  return {
    shipBuild: sanitizeBlock(source.shipBuild),
    upgrades: sanitizeBlock(source.upgrades),
    utility: sanitizeBlock(source.utility),
    engineering: sanitizeBlock(source.engineering),
    continuityHealth: sanitizeBlock(source.continuityHealth),
  };
}

export function serializeModeBridgeState(value = {}) {
  const hydrated = rehydrateModeBridgeState(value);
  return {
    schemaVersion: 1,
    ...hydrated,
  };
}

function buildContinuityKey({ roomName, sessionAnchor, accountAnchor }) {
  return `${String(roomName || 'tcentral-main')}::${String(sessionAnchor || 'guest-session')}::${String(accountAnchor || 'guest-account')}`;
}

function readContinuityVersion(params = {}) {
  return toFiniteNumber(getContinuityStore().get(buildContinuityKey(params))?.continuityVersion, 0, 0);
}

function writeContinuityVersion(params = {}, continuityVersion = 0) {
  getContinuityStore().set(buildContinuityKey(params), {
    continuityVersion: toFiniteNumber(continuityVersion, 0, 0),
    updatedAt: Date.now(),
  });
}

export function validateModeBridgeTransfer({ transfer, roomName, sessionAnchor, accountAnchor } = {}) {
  if (!transfer) return { ok: true };

  const expectedSessionAnchor = String(sessionAnchor || 'guest-session');
  const expectedAccountAnchor = String(accountAnchor || 'guest-account');
  const incomingSessionAnchor = String(transfer?.sessionAnchor || '');
  const incomingAccountAnchor = String(transfer?.accountAnchor || '');

  if (incomingSessionAnchor && incomingSessionAnchor !== expectedSessionAnchor) {
    return { ok: false, status: 409, error: 'MODE_BRIDGE_SESSION_ANCHOR_MISMATCH' };
  }

  if (incomingAccountAnchor && incomingAccountAnchor !== expectedAccountAnchor) {
    return { ok: false, status: 409, error: 'MODE_BRIDGE_ACCOUNT_ANCHOR_MISMATCH' };
  }

  const previousVersion = readContinuityVersion({ roomName, sessionAnchor: expectedSessionAnchor, accountAnchor: expectedAccountAnchor });
  const incomingVersion = toFiniteNumber(transfer?.continuityVersion, 0, 0);

  if (incomingVersion + MAX_STALE_WINDOW < previousVersion) {
    return {
      ok: false,
      status: 409,
      error: 'MODE_BRIDGE_STALE_TRANSFER',
      details: { continuityVersion: incomingVersion, expectedMinimum: previousVersion - MAX_STALE_WINDOW },
    };
  }

  return { ok: true, previousVersion, incomingVersion };
}

export function createModeBridgeTransfer({
  incomingTransfer,
  modeTransition,
  mode,
  roomName,
  sessionAnchor,
  accountAnchor,
  modeBridgeState,
  now = Date.now(),
} = {}) {
  const fromMode = normalizeSessionMode(modeTransition?.from, null);
  const toMode = normalizeSessionMode(modeTransition?.to || mode, SESSION_MODES.IDLE);
  const changedAt = toFiniteNumber(modeTransition?.changedAt, now, 0);
  const meteringSecond = Math.floor(changedAt / 1000);

  const incomingVersion = toFiniteNumber(incomingTransfer?.continuityVersion, 0, 0);
  const continuityVersion = modeTransition?.from && modeTransition?.to && modeTransition.from !== modeTransition.to
    ? incomingVersion + 1
    : incomingVersion;

  const nowUnix = Math.floor(now / 1000);
  const incomingSingle = toFiniteNumber(incomingTransfer?.singleplayerEpochUnix, 0, 0);
  const incomingMulti = toFiniteNumber(incomingTransfer?.multiplayerEpochUnix, 0, 0);

  const singleplayerEpochUnix = toMode === SESSION_MODES.SINGLE_PLAYER
    ? nowUnix
    : (incomingSingle || (fromMode === SESSION_MODES.SINGLE_PLAYER ? Math.floor(changedAt / 1000) : 0));

  const multiplayerEpochUnix = toMode === SESSION_MODES.MULTI_PLAYER
    ? nowUnix
    : (incomingMulti || (fromMode === SESSION_MODES.MULTI_PLAYER ? Math.floor(changedAt / 1000) : 0));

  const transfer = {
    schemaVersion: 1,
    continuityVersion,
    meteringSecond,
    singleplayerEpochUnix,
    multiplayerEpochUnix,
    fromMode: fromMode || null,
    toMode,
    sessionAnchor: String(sessionAnchor || 'guest-session'),
    accountAnchor: String(accountAnchor || 'guest-account'),
    state: serializeModeBridgeState(modeBridgeState),
    contractKeys: [...SCHEMA_KEYS],
  };

  writeContinuityVersion({ roomName, sessionAnchor: transfer.sessionAnchor, accountAnchor: transfer.accountAnchor }, continuityVersion);
  return transfer;
}
