import test from "node:test";
import assert from "node:assert/strict";
import { createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { createEncryptionEnvelope } from "../lib/security/envelope.js";
import {
  encryptSession,
  decryptSession,
  encryptJson,
  decryptJson,
  signValue,
} from "../lib/security.js";
const keys = { old: Buffer.alloc(32, 3), current: Buffer.alloc(32, 7) };
test("AES-GCM envelopes use fresh nonces and authenticated purpose, header and body", () => {
  const codec = createEncryptionEnvelope({ keys, activeKeyId: "current" }),
    options = { purpose: "account-session:google" };
  const a = codec.seal({ sub: "user" }, options),
    b = codec.seal({ sub: "user" }, options);
  assert.notEqual(a, b);
  assert.deepEqual(codec.open(a, options), { sub: "user" });
  assert.throws(() => codec.open(a, { purpose: "account-session:steam" }));
  assert.throws(() => codec.open(a.replace("current", "old"), options));
  const raw = Buffer.from(a.split(".")[2], "base64url");
  raw[raw.length - 1] ^= 1;
  assert.throws(() =>
    codec.open("v3.current." + raw.toString("base64url"), options),
  );
  assert.throws(() => codec.open(a + "=", options));
  assert.throws(() => codec.open("v3.unknown.AAAA", options));
  assert.throws(() => codec.open("a".repeat(100000), options));
});
test("the format interoperates with standard Node HKDF-SHA256 and AES-256-GCM", () => {
  const codec = createEncryptionEnvelope({ keys, activeKeyId: "current" }),
    token = codec.seal("private text", { purpose: "interop" }),
    raw = Buffer.from(token.split(".")[2], "base64url");
  const key = hkdfSync(
      "sha256",
      keys.current,
      "tcentral-encryption-v3",
      "interop",
      32,
    ),
    cipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  cipher.setAAD(Buffer.from("v3.current|interop"));
  cipher.setAuthTag(raw.subarray(12, 28));
  const decoded = JSON.parse(
    Buffer.concat([cipher.update(raw.subarray(28)), cipher.final()]),
  );
  assert.equal(decoded.value, "private text");
  assert(decoded.expiresAt > decoded.issuedAt);
});
test("expiry, maximum lifetime and clock skew are checked by the server", () => {
  let time = 10000;
  const codec = createEncryptionEnvelope({
    keys,
    activeKeyId: "current",
    now: () => time,
  });
  const token = codec.seal("value", { purpose: "session", ttlSeconds: 60 });
  time = 70000;
  assert.throws(() => codec.open(token, { purpose: "session" }));
  time = 10000;
  assert.throws(() =>
    codec.open(token, { purpose: "session", maxTtlSeconds: 30 }),
  );
  time = 4000;
  assert.throws(() => codec.open(token, { purpose: "session" }));
  const permanent = codec.seal("archive", {
    purpose: "field",
    ttlSeconds: null,
  });
  assert.throws(() => codec.open(permanent, { purpose: "field" }));
  assert.equal(
    codec.open(permanent, { purpose: "field", allowNoExpiry: true }),
    "archive",
  );
});
test("rotation reads retained old key IDs and rejects retired keys", () => {
  const old = createEncryptionEnvelope({
    keys: { old: keys.old },
    activeKeyId: "old",
  }).seal("stored", { purpose: "field" });
  const rotated = createEncryptionEnvelope({ keys, activeKeyId: "current" });
  assert.equal(rotated.open(old, { purpose: "field" }), "stored");
  assert.match(rotated.seal("new", { purpose: "field" }), /^v3\.current\./);
  assert.throws(() =>
    createEncryptionEnvelope({
      keys: { current: keys.current },
      activeKeyId: "current",
    }).open(old, { purpose: "field" }),
  );
  assert.throws(() =>
    createEncryptionEnvelope({
      keys: { current: "short" },
      activeKeyId: "current",
    }),
  );
});
test("account sessions reject cross-provider, generic-data and legacy tokens", () => {
  process.env.SESSION_SECRET =
    "fixture-only-strong-session-secret-" + randomBytes(16).toString("hex");
  const google = encryptSession({ sub: "verified" }, "google"),
    steam = encryptSession({ steamid: "76561198000000000" }, "steam");
  assert.equal(decryptSession(google, "google").sub, "verified");
  assert.equal(decryptSession(steam, "steam").steamid, "76561198000000000");
  assert.throws(() => decryptSession(google, "steam"));
  assert.throws(() =>
    decryptSession(encryptJson({ sub: "verified" }), "google"),
  );
  assert.throws(() => decryptSession("v2." + "A".repeat(100), "google"));
  assert.throws(() => decryptJson("v1." + "A".repeat(60)));
  assert.notEqual(
    signValue("same", { purpose: "public-policy" }),
    signValue("same", { purpose: "continuity-restore" }),
  );
});
