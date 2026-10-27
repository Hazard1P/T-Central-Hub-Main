const { PGlite } = await import(
  process.env.PGLITE_MODULE_PATH || "@electric-sql/pglite"
);
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
try {
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls;",
  );
  await db.exec(
    'create table public.player_reports (reference text, "reportedPlayer" text, "createdAt" timestamptz, reporter jsonb, server text, reason text, evidence text);',
  );
  await db.query(
    "insert into player_reports values ($1,$2,clock_timestamp(),$3,$4,$5,$6)",
    [
      "TC-LEGACY",
      "Legacy Pilot",
      { steamid: "76561198000000000", personaname: "Legacy Reporter" },
      "Hub",
      "Legacy reason",
      "Private legacy evidence",
    ],
  );
  for (const file of [
    "20261027_account_usernames.sql",
    "20261027_community_chat.sql",
    "20261027_player_moderation.sql",
  ])
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261027_player_moderation.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec("set timezone='America/Vancouver';set role service_role");
  const rpc = async (name, args) =>
    (
      await db.query(
        "select public." +
          name +
          "(" +
          args.map((_, i) => "$" + (i + 1)).join(",") +
          ") result",
        args,
      )
    ).rows[0].result;
  const access = () =>
    rpc("moderation_access", [
      ["google:player", "google:other", "steam:76561198000000000"],
    ]);
  const act = (
    action,
    target = "google:player",
    hours = null,
    ref = null,
    actor = "google:admin",
  ) =>
    rpc("moderation_apply_action", [
      actor,
      target,
      action,
      hours,
      "Reviewed evidence for action",
      ref,
    ]);
  for (const [provider, id, name] of [
    ["google", "player", "Explorer"],
    ["google", "other", "OtherPilot"],
    ["google", "admin", "Admin"],
    ["steam", "76561198000000000", "Explorer"],
  ])
    await rpc("account_username", [
      provider,
      id,
      name,
      provider === "google" ? name : null,
    ]);
  const report = {
    reportedPlayer: "Explorer",
    server: "Shared universe",
    reason: "Harassment",
    evidence: "Private evidence",
  };
  const submit = (body, key) =>
    rpc("moderation_submit_report", [
      body,
      { accountKey: "google:other", displayName: "OtherPilot" },
      key,
    ]);
  const ambiguous = await submit(report, "first");
  assert(ambiguous.ok);
  let overview = await rpc("moderation_overview", [""]);
  assert.equal(
    overview.reports.find((r) => r.reference === ambiguous.reference)
      .target_key,
    null,
    "duplicate names must not silently target one player",
  );
  assert(overview.reports.some((r) => r.reference === "TC-LEGACY"));
  assert.equal(
    overview.reports.filter((r) => r.reference === "TC-LEGACY").length,
    1,
  );
  assert(!("rate_key" in overview.reports[0]));
  assert.equal((await submit(report, "first")).status, 429);
  const bound = await submit(
    { ...report, targetKey: "google:player" },
    "second",
  );
  assert(bound.ok);
  assert.equal(
    (await submit({ ...report, targetKey: "google:unknown" }, "third")).status,
    400,
  );
  assert.equal(
    (await act("ban", "google:other", null, bound.reference)).error,
    "REPORT_ACCOUNT_MISMATCH",
  );
  assert.equal(
    (await act("ban", "google:admin")).status,
    400,
    "self ban prohibited",
  );
  assert.equal((await act("temp_ban", "google:player", 0)).status, 400);
  assert.equal(
    (await act("review", "google:nonexistent", null, ambiguous.reference))
      .status,
    400,
  );
  const temporary = await act("temp_ban", "google:player", 24, bound.reference);
  assert(temporary.ok);
  let active = await access();
  assert.equal(active.bans.length, 1);
  assert.equal(active.bans[0].account_key, "google:player");
  const banRow = (
    await db.query(
      "select * from player_bans where account_key='google:player'",
    )
  ).rows[0];
  assert.equal(
    new Date(banRow.expires_at) - new Date(banRow.created_at),
    24 * 60 * 60 * 1000,
  );
  await db.query(
    "update account_usernames set username='RenamedPilot' where provider='google' and account_id='player'",
  );
  assert.equal(
    (await access()).bans.length,
    1,
    "renaming cannot bypass account bans",
  );
  await db.query(
    "update player_bans set expires_at=clock_timestamp()-interval '1 second' where account_key='google:player'",
  );
  assert.equal(
    (await access()).bans.length,
    0,
    "temporary ban expires on server time",
  );
  assert((await act("ban")).ok);
  assert.equal((await access()).bans[0].expires_at, null);
  assert((await act("unban")).ok);
  assert.equal((await access()).bans.length, 0);
  assert.equal((await act("unban")).status, 409);
  assert((await act("review", null, null, ambiguous.reference)).ok);
  assert((await act("dismiss", null, null, ambiguous.reference)).ok);
  overview = await rpc("moderation_overview", [bound.reference]);
  assert.equal(overview.reports.length, 1);
  assert.equal(overview.reports[0].status, "resolved");
  assert(overview.actions.length >= 5);
  const search = await rpc("moderation_overview", ["Renamed"]);
  assert.equal(search.accounts[0].account_key, "google:player");
  assert((await act("ban", "steam:76561198000000000")).ok);
  assert.equal((await access()).bans[0].account_key, "steam:76561198000000000");
  assert((await act("unban", "steam:76561198000000000")).ok);
  assert(
    (
      await act(
        "review",
        null,
        null,
        ambiguous.reference,
        "steam:76561198000000000",
      )
    ).ok,
  );
  const chat = await rpc("community_chat_post", [
    "google:other",
    "OtherPilot",
    "Hello community <script>test</script>",
  ]);
  assert(chat.ok);
  assert(!("author_key" in chat.message));
  assert.equal(
    (
      await rpc("community_chat_post", [
        "google:other",
        "OtherPilot",
        "Too fast",
      ])
    ).status,
    429,
  );
  assert.equal((await rpc("community_chat_history", [])).messages.length, 1);
  const chatReport = await submit(
    { ...report, targetKey: "google:player", chatMessageId: chat.message.id },
    "chat-report",
  );
  assert(chatReport.ok);
  const chatQueue = await rpc("moderation_overview", [chatReport.reference]);
  assert.equal(
    chatQueue.reports[0].target_key,
    "google:other",
    "chat reports bind to the stored sender, never a forged target",
  );
  assert((await act("ban", "google:other")).ok);
  assert.equal(
    (
      await rpc("community_chat_post", [
        "google:other",
        "OtherPilot",
        "Banned sender",
      ])
    ).error,
    "ACCOUNT_BANNED",
  );
  assert((await act("unban", "google:other")).ok);
  const hidden = await rpc("moderation_hide_chat", [
    "google:admin",
    chat.message.id,
    "Reviewed abusive chat evidence",
  ]);
  assert(hidden.ok);
  assert.equal((await rpc("community_chat_history", [])).messages.length, 0);
  assert.equal(
    (await rpc("moderation_overview", [""])).actions[0].chat_message_id,
    chat.message.id,
  );
  const retainedReport = await rpc("moderation_overview", [
    chatReport.reference,
  ]);
  assert.equal(retainedReport.reports[0].chatMessage.body, chat.message.body);
  assert(
    retainedReport.reports[0].chatMessage.hiddenAt,
    "hidden evidence remains available only to authorized reviewers",
  );
  for (const role of ["anon", "authenticated"]) {
    await db.exec("reset role;set role " + role);
    for (const table of [
      "moderation_reports",
      "player_bans",
      "moderation_actions",
      "player_reports",
      "community_chat_messages",
    ])
      await assert.rejects(
        db.query("select * from " + table),
        (e) => e.code === "42501",
      );
    for (const [name, args] of [
      ["community_chat_history", []],
      ["community_chat_post", ["google:other", "Forged", "Bypass"]],
      [
        "moderation_hide_chat",
        ["google:admin", chat.message.id, "Forged actor"],
      ],
      ["moderation_access", [["google:player"]]],
      ["moderation_overview", [""]],
      [
        "moderation_apply_action",
        ["google:admin", "google:player", "ban", null, "Forged actor", null],
      ],
      ["moderation_submit_report", [report, null, "forged"]],
    ])
      await assert.rejects(rpc(name, args), (e) => e.code === "42501");
  }
  console.log(
    "PASS moderation SQL: legacy import, private grants, ambiguous-name protection, account-bound reports, rate limiting, audit trail, self-ban prevention, report-target protection, temporary expiry, permanent bans, rename persistence, revocation and search.",
  );
} finally {
  await db.close();
}
