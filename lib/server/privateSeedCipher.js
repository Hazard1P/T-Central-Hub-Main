import { createHash, createHmac, hkdfSync } from "node:crypto";
import { createEncryptionEnvelope } from "../security/envelope.js";
function context(row) {
  return (
    "private-seed:" +
    createHash("sha256")
      .update(
        JSON.stringify(
          [
            row.account_key,
            row.id,
            row.cyber_intelligence_id,
            row.epoch_unix,
            row.flight_signature,
            row.binding_hash,
          ].map((value) => String(value ?? "")),
        ),
      )
      .digest("hex")
  );
}
export function createPrivateSeedCipher({ keys, activeKeyId }) {
  const envelope = createEncryptionEnvelope({ keys, activeKeyId });
  const signingKey = hkdfSync(
    "sha256",
    keys[activeKeyId],
    "tcentral-private-data-v3",
    "seed-content-binding",
    32,
  );
  return {
    protect(row) {
      const binding_hash = createHmac("sha256", signingKey)
        .update(
          JSON.stringify(
            [
              row.account_key,
              row.id,
              row.cyber_intelligence_id,
              row.epoch_unix,
              row.flight_signature,
              row.body,
            ].map((value) => String(value ?? "")),
          ),
        )
        .digest("hex");
      const protectedRow = { ...row, binding_hash, body: "[encrypted]" };
      protectedRow.body_ciphertext = envelope.seal(row.body, {
        purpose: context(protectedRow),
        ttlSeconds: null,
      });
      return protectedRow;
    },
    reveal(row) {
      if (!row?.body_ciphertext) return row;
      const { body_ciphertext, ...metadata } = row;
      return {
        ...metadata,
        body: envelope.open(body_ciphertext, {
          purpose: context(row),
          allowNoExpiry: true,
        }),
      };
    },
  };
}
export function privateSeedCipherFromEnvironment(env = process.env) {
  let encoded;
  try {
    encoded = JSON.parse(env.DATA_ENCRYPTION_KEYS || "{}");
  } catch {
    throw Error("Invalid private-data key configuration.");
  }
  if (!encoded || typeof encoded !== "object" || Array.isArray(encoded))
    throw Error("Invalid private-data key configuration.");
  const keys = {};
  for (const [id, value] of Object.entries(encoded)) {
    if (typeof value !== "string")
      throw Error("Private-data keys must be base64-encoded 32-byte keys.");
    const bytes = Buffer.from(value, "base64");
    if (bytes.length !== 32 || bytes.toString("base64") !== value)
      throw Error("Private-data keys must be base64-encoded 32-byte keys.");
    keys[id] = bytes;
  }
  return createPrivateSeedCipher({
    keys,
    activeKeyId: env.DATA_ENCRYPTION_KEY_ID,
  });
}
// Read plaintext legacy rows without a key; encrypted rows and every new app
// write require configured keys. Never invent an ephemeral persistent-data key.
export const privateSeedCipher = {
  protect: (row) => privateSeedCipherFromEnvironment().protect(row),
  reveal: (row) =>
    row?.body_ciphertext ? privateSeedCipherFromEnvironment().reveal(row) : row,
};
