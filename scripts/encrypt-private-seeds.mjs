// Dry run by default. Run with --apply only after installing/retaining data keys.
import { getSupabaseAdmin } from "../lib/server/supabaseAdmin.js";
import { privateSeedCipherFromEnvironment } from "../lib/server/privateSeedCipher.js";
const admin = getSupabaseAdmin();
if (!admin) throw Error("Server database credentials are required.");
const apply = process.argv.includes("--apply"),
  rotate = process.argv.includes("--rotate"),
  cipher = apply ? privateSeedCipherFromEnvironment() : null;
let cursor = null,
  scanned = 0,
  encrypted = 0;
while (true) {
  let query = admin
    .from("account_prayer_seeds")
    .select("*")
    .order("id")
    .limit(100);
  if (!rotate) query = query.is("body_ciphertext", null);
  if (cursor) query = query.gt("id", cursor);
  const { data, error } = await query;
  if (error) throw Error("Unable to read private seed migration batch.");
  if (!data?.length) break;
  for (const row of data) {
    scanned++;
    if (apply) {
      if (
        rotate &&
        row.body_ciphertext?.startsWith(
          "v3." + process.env.DATA_ENCRYPTION_KEY_ID + ".",
        )
      )
        continue;
      const sealed = cipher.protect(
        row.body_ciphertext ? cipher.reveal(row) : row,
      );
      let update = admin
        .from("account_prayer_seeds")
        .update({
          body: sealed.body,
          body_ciphertext: sealed.body_ciphertext,
          binding_hash: sealed.binding_hash,
        })
        .eq("id", row.id);
      update = row.body_ciphertext
        ? update.eq("body_ciphertext", row.body_ciphertext)
        : update.is("body_ciphertext", null);
      const result = await update.select("id");
      if (result.error)
        throw Error(
          "Private seed migration failed; completed rows remain safely encrypted.",
        );
      encrypted += result.data?.length || 0;
    }
  }
  cursor = data.at(-1).id;
}
console.log(
  JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    rotate,
    scanned,
    encrypted,
  }),
);
