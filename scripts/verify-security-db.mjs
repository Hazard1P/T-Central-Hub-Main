const { PGlite } = await import(
  process.env.PGLITE_MODULE_PATH || "@electric-sql/pglite"
);
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createPrivateSeedCipher } from "../lib/server/privateSeedCipher.js";
import {
  createBoundPrayerSeed,
  createCyberIntelligence,
} from "../lib/server/prayerSeedRecords.js";
const db = new PGlite();
try {
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;",
  );
  for (const file of [
    "20260607_player_account_ledger.sql",
    "20260607_player_accounts.sql",
    "20260419_progression_and_moderation.sql",
    "20261018_account_prayer_seeds.sql",
  ])
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  await db.exec(
    "create table contact_submissions(id int,private_evidence text);grant all on player_progression,player_accounts,player_account_ledger,contact_submissions to anon,authenticated;",
  );
  const auth = {
      authenticated: true,
      provider: "google",
      accountId: "secure-owner",
      displayName: "Pilot",
    },
    profile = createCyberIntelligence(auth),
    seed = createBoundPrayerSeed(auth, profile, {
      body: "Private database text",
      requestId: "security-fixture-request",
      flightSignature: "shared:halcyon",
    });
  const insert = async (table, row) => {
    const keys = Object.keys(row);
    return db.query(
      "insert into " +
        table +
        "(" +
        keys.map((key) => '"' + key + '"').join(",") +
        ") values (" +
        keys.map((_, i) => "$" + (i + 1)).join(",") +
        ")",
      keys.map((key) =>
        typeof row[key] === "object" ? JSON.stringify(row[key]) : row[key],
      ),
    );
  };
  await insert("player_accounts", {
    account_key: "google:secure-owner",
    provider: "google",
    account_id: "secure-owner",
  });
  await insert("account_cyber_intelligence", profile);
  await insert("account_prayer_seeds", seed);
  for (const file of [
    "20261028_security_private_tables.sql",
    "20261028_private_seed_encryption.sql",
  ]) {
    const sql = await readFile(
      new URL("../supabase/migrations/" + file, import.meta.url),
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql);
  }
  assert.equal(
    (await db.query("select body from account_prayer_seeds")).rows[0].body,
    seed.body,
    "additive migration preserves legacy plaintext until an explicit migration",
  );
  const cipher = createPrivateSeedCipher({
      keys: { fixture: Buffer.alloc(32, 7) },
      activeKeyId: "fixture",
    }),
    encrypted = cipher.protect(seed);
  await db.exec("set role service_role");
  await db.query(
    "update account_prayer_seeds set body=$1,body_ciphertext=$2,binding_hash=$3 where id=$4",
    [
      encrypted.body,
      encrypted.body_ciphertext,
      encrypted.binding_hash,
      seed.id,
    ],
  );
  const row = (await db.query("select * from account_prayer_seeds")).rows[0];
  assert.equal(row.body, "[encrypted]");
  assert(!JSON.stringify(row).includes(seed.body));
  assert.equal(cipher.reveal(row).body, seed.body);
  await assert.rejects(
    db.query(
      "update account_prayer_seeds set body_ciphertext='v1.invalid' where id=$1",
      [seed.id],
    ),
    (e) => e.code === "23514",
  );
  for (const role of ["anon", "authenticated"]) {
    await db.exec("reset role;set role " + role);
    for (const table of [
      "player_progression",
      "player_accounts",
      "player_account_ledger",
      "contact_submissions",
      "account_prayer_seeds",
    ])
      await assert.rejects(
        db.query("select * from " + table),
        (e) => e.code === "42501",
      );
  }
  console.log(
    "PASS security SQL: rerunnable migrations, preserved legacy seeds, ciphertext-only new storage, decryption roundtrip, invalid format rejection and private database permissions.",
  );
} finally {
  await db.close();
}
