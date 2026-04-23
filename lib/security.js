import crypto from 'crypto';

const SESSION_KEY_VERSION = Number.parseInt(process.env.SESSION_KEY_VERSION ?? '2', 10);
const PAYLOAD_VERSION_PREFIX = `v${Number.isNaN(SESSION_KEY_VERSION) ? 2 : SESSION_KEY_VERSION}.`;
const LEGACY_PAYLOAD_VERSION_PREFIX = 'v1.';
let cachedDevSecret;
let warnedMissingSecret = false;
let cachedLegacyKeyMaterial;
let cachedMasterKey;
const derivedKeyCache = new Map();

function getSessionSecret() {
  const sessionSecret = process.env.SESSION_SECRET;

  if (sessionSecret) {
    return sessionSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is required in production for session cryptography.');
  }

  if (!cachedDevSecret) {
    cachedDevSecret = crypto.randomBytes(32).toString('base64url');
  }

  if (!warnedMissingSecret) {
    warnedMissingSecret = true;
    console.warn('SESSION_SECRET is not set; using an ephemeral in-memory secret for non-production runtime.');
  }

  return cachedDevSecret;
}

function getLegacySessionKeyMaterial() {
  if (!cachedLegacyKeyMaterial) {
    cachedLegacyKeyMaterial = crypto
      .createHash('sha256')
      .update(getSessionSecret())
      .digest();
  }

  return cachedLegacyKeyMaterial;
}

function getMasterKey() {
  if (!cachedMasterKey) {
    cachedMasterKey = crypto
      .createHash('sha512')
      .update(getSessionSecret())
      .digest();
  }

  return cachedMasterKey;
}

function deriveKey({ salt, context, length }) {
  const cacheKey = `${context}:${salt.toString('base64url')}:${length}`;
  const cached = derivedKeyCache.get(cacheKey);
  if (cached) return cached;

  const key = crypto.scryptSync(getMasterKey(), salt, length, {
    N: 1 << 15,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });

  derivedKeyCache.set(cacheKey, key);
  return key;
}

function decodePayload(encoded) {
  if (!encoded || typeof encoded !== 'string') {
    throw new Error('Encrypted payload must be a non-empty string.');
  }

  const splitIndex = encoded.indexOf('.');
  const hasVersion = encoded.startsWith('v') && splitIndex > 1;
  const version = hasVersion ? encoded.slice(0, splitIndex) : 'v1';
  const payload = hasVersion ? encoded.slice(splitIndex + 1) : encoded;

  return { version, raw: Buffer.from(payload, 'base64url') };
}

export function encryptJson(value) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey({ salt, context: 'encrypt', length: 32 });
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  cipher.setAAD(Buffer.from(PAYLOAD_VERSION_PREFIX, 'utf8'));
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([salt, iv, tag, ciphertext]).toString('base64url');

  return `${PAYLOAD_VERSION_PREFIX}${payload}`;
}

export function decryptJson(encoded) {
  const { version, raw } = decodePayload(encoded);

  if (version === 'v1') {
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getLegacySessionKeyMaterial(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  }

  if (version === 'v2') {
    const salt = raw.subarray(0, 16);
    const iv = raw.subarray(16, 28);
    const tag = raw.subarray(28, 44);
    const ciphertext = raw.subarray(44);
    const key = deriveKey({ salt, context: 'encrypt', length: 32 });
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(`${version}.`, 'utf8'));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  }

  if (encoded.startsWith(LEGACY_PAYLOAD_VERSION_PREFIX)) {
    throw new Error('Legacy payload version mismatch. Expected v1 prefix parsing.');
  }

  throw new Error(`Unsupported encrypted payload version: ${version}`);
}

export function signValue(value) {
  const salt = Buffer.from('system-signature-v2', 'utf8');
  const key = deriveKey({ salt, context: 'sign', length: 64 });

  return crypto
    .createHmac('sha512', key)
    .update(value)
    .digest('base64url');
}
