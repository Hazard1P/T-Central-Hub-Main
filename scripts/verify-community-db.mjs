const { PGlite } = await import(
  process.env.PGLITE_MODULE_PATH || "@electric-sql/pglite"
);
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { COMMUNITY_BOARDS } from "../lib/communitySections.js";
const db = new PGlite();
try {
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls",
  );
  for (const file of [
    "20260608_hub_posts.sql",
    "20261019_community_post_headings.sql",
  ])
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  const author = {
    provider: "google",
    accountId: "verified",
    displayName: "Pilot",
  };
  await db.query(
    "insert into hub_posts(reference,topic,category,message,author,subheading) values ($1,$2,$3,$4,$5,$6),($7,$8,$9,$10,$11,$12)",
    [
      "HB-OLD",
      "Old bug",
      "Bug report",
      "Old bug details",
      author,
      "Original subheading",
      "HB-SERVER",
      "Arma feedback",
      "Server feedback",
      "Arma operations",
      author,
      "Keep game context",
    ],
  );
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20261027_forum_sections.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(migration);
  await db.exec(migration);
  assert.equal(
    (await db.query("select board from hub_posts where reference='HB-OLD'"))
      .rows[0].board,
    "bugs-help",
  );
  const legacy = (
    await db.query("select * from hub_posts where reference='HB-SERVER'")
  ).rows[0];
  assert.equal(legacy.board, "general-discussion");
  assert.equal(legacy.category, "Server feedback");
  assert.equal(legacy.subheading, "Keep game context");
  await db.exec("set role service_role");
  for (const board of COMMUNITY_BOARDS)
    await db.query(
      "insert into hub_posts(reference,topic,category,message,author,board,subheading) values ($1,$2,$3,$4,$5,$6,$7)",
      [
        "HB-" + board.key,
        board.title,
        board.category,
        "Discuss this topic",
        author,
        board.key,
        "A useful introduction",
      ],
    );
  assert.equal(
    (await db.query("select count(*)::int n from hub_posts")).rows[0].n,
    COMMUNITY_BOARDS.length + 2,
  );
  await assert.rejects(
    db.query(
      "update hub_posts set board='unrecognized-section' where reference='HB-OLD'",
    ),
    (e) => e.code === "23514",
  );
  for (const role of ["anon", "authenticated"]) {
    await db.exec("reset role;set role " + role);
    await assert.rejects(
      db.query("select * from hub_posts"),
      (e) => e.code === "42501",
    );
  }
  console.log(
    "PASS community SQL: rerunnable subsection migration, preserved legacy headings/category, all subsection schemas accepted, unknown subsection rejected and private storage grants.",
  );
} finally {
  await db.close();
}
