import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
const MAX_BYTES = 96 * 1024;
const validId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(value);
const invalid = () => new Error("Invalid or expired encrypted value.");
// AES-GCM authenticates the version, key ID and caller-supplied purpose. HKDF
// separates keys by purpose; no key is derived from untrusted cookie salts.
export function createEncryptionEnvelope({
  keys,
  activeKeyId,
  now = Date.now,
}) {
  if (
    !validId(activeKeyId) ||
    !keys ||
    !Object.hasOwn(keys, activeKeyId) ||
    Object.keys(keys).length > 8
  )
    throw Error(
      "Configure an active encryption key and at most eight rotation keys.",
    );
  const ring = new Map(
    Object.entries(keys).map(([id, secret]) => {
      if (
        !validId(id) ||
        !(typeof secret === "string" || Buffer.isBuffer(secret)) ||
        Buffer.byteLength(secret) < 32
      )
        throw Error("Encryption keys must contain at least 32 bytes.");
      return [id, secret];
    }),
  );
  const derive = (id, purpose) => {
    if (
      !ring.has(id) ||
      typeof purpose !== "string" ||
      !purpose.length ||
      purpose.length > 256
    )
      throw invalid();
    return Buffer.from(
      hkdfSync("sha256", ring.get(id), "tcentral-encryption-v3", purpose, 32),
    );
  };
  return {
    seal(value, { purpose, ttlSeconds = 604800 } = {}) {
      if (value === undefined) throw Error("An encryption value is required.");
      if (
        ttlSeconds !== null &&
        (!Number.isFinite(ttlSeconds) ||
          ttlSeconds <= 0 ||
          ttlSeconds > 31536000)
      )
        throw Error("Invalid encryption lifetime.");
      const issuedAt = now(),
        plain = Buffer.from(
          JSON.stringify({
            issuedAt,
            expiresAt:
              ttlSeconds === null ? null : issuedAt + ttlSeconds * 1000,
            value,
          }),
        );
      if (plain.length > 64 * 1024)
        throw Error("Encrypted value is too large.");
      const nonce = randomBytes(12),
        prefix = "v3." + activeKeyId,
        cipher = createCipheriv(
          "aes-256-gcm",
          derive(activeKeyId, purpose),
          nonce,
        );
      cipher.setAAD(Buffer.from(prefix + "|" + purpose));
      const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
      return (
        prefix +
        "." +
        Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString(
          "base64url",
        )
      );
    },
    open(
      token,
      { purpose, maxTtlSeconds = 31536000, allowNoExpiry = false } = {},
    ) {
      if (typeof token !== "string" || token.length > MAX_BYTES)
        throw invalid();
      const [version, id, payload, extra] = token.split(".");
      if (
        version !== "v3" ||
        !validId(id) ||
        !ring.has(id) ||
        !payload ||
        !/^[A-Za-z0-9_-]+$/.test(payload) ||
        extra !== undefined
      )
        throw invalid();
      const raw = Buffer.from(payload, "base64url");
      if (raw.length < 29 || raw.toString("base64url") !== payload)
        throw invalid();
      try {
        const decipher = createDecipheriv(
          "aes-256-gcm",
          derive(id, purpose),
          raw.subarray(0, 12),
        );
        decipher.setAAD(Buffer.from(version + "." + id + "|" + purpose));
        decipher.setAuthTag(raw.subarray(12, 28));
        const body = JSON.parse(
            Buffer.concat([
              decipher.update(raw.subarray(28)),
              decipher.final(),
            ]).toString("utf8"),
          ),
          time = now();
        if (
          !Number.isFinite(body.issuedAt) ||
          body.issuedAt > time + 5000 ||
          !Object.hasOwn(body, "value")
        )
          throw invalid();
        if (body.expiresAt === null) {
          if (!allowNoExpiry) throw invalid();
        } else if (
          !Number.isFinite(body.expiresAt) ||
          body.expiresAt <= time ||
          body.expiresAt <= body.issuedAt ||
          body.expiresAt - body.issuedAt > maxTtlSeconds * 1000
        )
          throw invalid();
        return body.value;
      } catch {
        throw invalid();
      }
    },
  };
}
