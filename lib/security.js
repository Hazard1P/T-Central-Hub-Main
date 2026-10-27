import crypto from "node:crypto";
import { createEncryptionEnvelope } from "./security/envelope.js";
let devSecret;
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret) {
    if (
      Buffer.byteLength(secret) < 32 ||
      /^(replace-with|change-?me|your-secret)/i.test(secret)
    )
      throw Error(
        "SESSION_SECRET must be a randomly generated secret of at least 32 bytes.",
      );
    return secret;
  }
  if (process.env.NODE_ENV === "production")
    throw Error("SESSION_SECRET is required in production.");
  if (!devSecret) {
    devSecret = crypto.randomBytes(32).toString("base64url");
    console.warn(
      "Using an ephemeral session secret for local development only.",
    );
  }
  return devSecret;
}
function sessionKeys() {
  const activeKeyId = process.env.SESSION_KEY_ID || "current";
  let previous = {};
  if (process.env.SESSION_PREVIOUS_KEYS) {
    try {
      previous = JSON.parse(process.env.SESSION_PREVIOUS_KEYS);
    } catch {
      throw Error("Invalid SESSION_PREVIOUS_KEYS configuration.");
    }
  }
  if (
    !previous ||
    Array.isArray(previous) ||
    typeof previous !== "object" ||
    Object.hasOwn(previous, activeKeyId)
  )
    throw Error("Invalid session rotation key configuration.");
  return { keys: { ...previous, [activeKeyId]: sessionSecret() }, activeKeyId };
}
export function encryptJson(
  value,
  { purpose = "data", ttlSeconds = 180 * 86400 } = {},
) {
  return createEncryptionEnvelope(sessionKeys()).seal(value, {
    purpose,
    ttlSeconds,
  });
}
export function decryptJson(
  value,
  { purpose = "data", allowLegacy = false } = {},
) {
  if (allowLegacy && !value?.startsWith("v3.")) return decryptLegacyJson(value);
  return createEncryptionEnvelope(sessionKeys()).open(value, { purpose });
}
export function encryptSession(value, provider) {
  if (!["steam", "google"].includes(provider))
    throw Error("Invalid session provider.");
  return encryptJson(value, {
    purpose: "account-session:" + provider,
    ttlSeconds: SESSION_TTL_SECONDS,
  });
}
export function decryptSession(value, provider) {
  if (!["steam", "google"].includes(provider))
    throw Error("Invalid session provider.");
  const session = createEncryptionEnvelope(sessionKeys()).open(value, {
    purpose: "account-session:" + provider,
    maxTtlSeconds: SESSION_TTL_SECONDS,
  });
  if (!session || typeof session !== "object" || Array.isArray(session))
    throw Error("Invalid account session.");
  if (
    provider === "steam" &&
    (typeof session.steamid !== "string" || !/^\d{17}$/.test(session.steamid))
  )
    throw Error("Invalid Steam identity.");
  if (
    provider === "google" &&
    (typeof session.sub !== "string" ||
      !/^[A-Za-z0-9_-]{1,160}$/.test(session.sub))
  )
    throw Error("Invalid Google identity.");
  return session;
}
// Legacy data-cookie recovery is explicit, bounded and never used for login.
// The sole live caller is the already-authenticated Prayer Seed migration.
let legacyWindow = 0,
  legacyCount = 0;
function decryptLegacyJson(encoded) {
  if (
    typeof encoded !== "string" ||
    encoded.length > 8192 ||
    !/^(v[12]\.)?[A-Za-z0-9_-]+$/.test(encoded)
  )
    throw Error("Invalid legacy value.");
  const version = encoded.startsWith("v2.") ? "v2" : "v1",
    payload = encoded.replace(/^v[12]\./, ""),
    raw = Buffer.from(payload, "base64url");
  if (
    raw.toString("base64url") !== payload ||
    raw.length < (version === "v2" ? 45 : 29)
  )
    throw Error("Invalid legacy value.");
  const time = Date.now();
  if (time - legacyWindow > 60000) {
    legacyWindow = time;
    legacyCount = 0;
  }
  if (++legacyCount > 8) throw Error("Legacy recovery rate exceeded.");
  const secret = process.env.SESSION_LEGACY_SECRET || sessionSecret();
  const key =
    version === "v2"
      ? crypto.scryptSync(
          crypto.createHash("sha512").update(secret).digest(),
          raw.subarray(0, 16),
          32,
          { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
        )
      : crypto.createHash("sha256").update(secret).digest();
  const offset = version === "v2" ? 16 : 0,
    decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      raw.subarray(offset, offset + 12),
    );
  if (version === "v2") decipher.setAAD(Buffer.from("v2."));
  decipher.setAuthTag(raw.subarray(offset + 12, offset + 28));
  return JSON.parse(
    Buffer.concat([
      decipher.update(raw.subarray(offset + 28)),
      decipher.final(),
    ]).toString("utf8"),
  );
}
export function signValue(value, { purpose = "reference" } = {}) {
  if (typeof purpose !== "string" || !purpose.length)
    throw Error("A signature purpose is required.");
  const key = crypto.hkdfSync(
    "sha256",
    sessionSecret(),
    "tcentral-signatures-v3",
    purpose,
    32,
  );
  return crypto
    .createHmac("sha256", key)
    .update(String(value))
    .digest("base64url");
}

export function isSessionEncryptionConfigured() {
  try {
    createEncryptionEnvelope(sessionKeys());
    return true;
  } catch {
    return false;
  }
}
