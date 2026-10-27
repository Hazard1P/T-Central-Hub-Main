import test from "node:test";
import assert from "node:assert/strict";
import {
  isModerationAdmin,
  configuredModerationAdmins,
  configuredSiteOwner,
  normalizePlayerReport,
  banDenial,
} from "../lib/moderation.js";
import { createModerationRepository } from "../lib/server/moderationRepository.js";
const report = {
  reportedPlayer: "Pilot One",
  server: "Shared universe",
  reason: "Griefing",
  evidence: "Observed repeated spawn attacks.",
};
const allowed = { authenticated: true, provider: "google", accountId: "owner" };
const mock = (value) => {
  const calls = [];
  return {
    calls,
    rpc(name, args) {
      calls.push({ name, args });
      return { abortSignal: async () => value };
    },
  };
};
test("moderation admins require a verified provider and exact stable account ID", () => {
  assert(isModerationAdmin(allowed, "google:owner,steam:76561198000000000"));
  assert(
    isModerationAdmin(
      {
        authenticated: true,
        provider: "steam",
        accountId: "76561198000000000",
      },
      "steam:76561198000000000",
    ),
  );
  for (const auth of [
    { ...allowed, authenticated: false },
    { ...allowed, provider: "steam" },
    { ...allowed, accountId: "OWNER" },
    { ...allowed, accountId: "someone", displayName: "owner", isAdmin: true },
  ])
    assert(!isModerationAdmin(auth, "google:owner"));
  assert(!isModerationAdmin(allowed, ""));
  assert(!isModerationAdmin(allowed, "owner"));
});
test("reports reject whitespace, oversized evidence, forged account formats and bind only normalized fields", () => {
  assert.deepEqual(
    normalizePlayerReport({
      ...report,
      reportedPlayer: " Pilot One ",
      reporter: { accountKey: "google:admin" },
    }),
    { ...report, targetKey: null },
  );
  for (const body of [
    null,
    {},
    { ...report, evidence: " " },
    { ...report, evidence: "x".repeat(5001) },
    { ...report, targetKey: "admin" },
    { ...report, targetKey: {} },
  ])
    assert.throws(() => normalizePlayerReport(body), { status: 400 });
  assert.equal(
    normalizePlayerReport({ ...report, targetKey: "google:one" }).targetKey,
    "google:one",
  );
});
test("report RPC receives the trusted reporter and ignores forged body identity", async () => {
  const admin = mock({ data: { ok: true, reference: "TC-ONE" } }),
    repo = createModerationRepository(admin);
  await repo.submit(
    {
      ...report,
      reporter: { accountKey: "google:forged" },
      createdAt: "tomorrow",
    },
    { accountKey: "google:verified" },
    "google:verified",
  );
  assert.equal(admin.calls[0].args.p_reporter.accountKey, "google:verified");
  assert(!("createdAt" in admin.calls[0].args.p_report));
});
test("moderation actions bind the verified admin actor and validate duration/reason", async () => {
  const admin = mock({ data: { ok: true } }),
    repo = createModerationRepository(admin);
  await repo.act(
    {
      action: "temp_ban",
      targetKey: "google:one",
      hours: 24,
      reason: "Reviewed evidence",
      actor: "google:forged",
      expiresAt: "never",
    },
    "google:admin",
  );
  assert.equal(admin.calls[0].args.p_actor, "google:admin");
  assert.equal(admin.calls[0].args.p_hours, 24);
  assert(!("expiresAt" in admin.calls[0].args));
  for (const hours of [0, -1, 1.5, 8761, "24"])
    assert.throws(
      () =>
        repo.act(
          { action: "temp_ban", hours, reason: "Reviewed evidence" },
          "google:admin",
        ),
      { status: 400 },
    );
  assert.throws(
    () => repo.act({ action: "ban", reason: " " }, "google:admin"),
    { status: 400 },
  );
});
test("account access fails closed on storage errors, while guests need no account lookup", async () => {
  const repo = createModerationRepository(null);
  assert.deepEqual(await repo.access(["guest:one"]), { ok: true, bans: [] });
  assert.equal((await repo.access(["google:one"])).ok, false);
  assert.equal(
    banDenial(await repo.access(["google:one"]), "google:one").status,
    503,
  );
  await assert.rejects(repo.submit(report, null, "guest:one"), { status: 503 });
  const failing = createModerationRepository(
    mock({ error: { message: "offline" } }),
  );
  assert.equal((await failing.access(["google:one"])).ok, false);
});
test("only the exact provider account is denied and expiry/reason reach the flight UI", () => {
  const result = {
    ok: true,
    bans: [
      {
        account_key: "google:one",
        reason: "Reviewed abuse",
        expires_at: "2026-11-01T00:00:00Z",
      },
    ],
  };
  assert.deepEqual(banDenial(result, "google:one"), {
    ok: false,
    status: 403,
    error: "ACCOUNT_BANNED",
    reason: "Reviewed abuse",
    expiresAt: "2026-11-01T00:00:00Z",
  });
  assert.deepEqual(banDenial(result, "steam:76561198000000000"), { ok: true });
});

test("the deployment owner is provider-bound and inherits moderation without trusting a browser role", () => {
  const configured = { SITE_OWNER_ACCOUNT: "google:owner" };
  assert.equal(configuredSiteOwner(configured), "google:owner");
  assert(
    isModerationAdmin(
      allowed,
      configuredModerationAdmins(configured).join(","),
    ),
  );
  assert.deepEqual(
    configuredModerationAdmins({ DYSON_ADMIN_ACCOUNT_ID: "owner" }),
    [],
    "unscoped legacy IDs must not grant ownership",
  );
  assert.deepEqual(
    configuredModerationAdmins({
      DYSON_ADMIN_PROVIDER: "google",
      DYSON_ADMIN_ACCOUNT_ID: "owner",
    }),
    ["google:owner"],
  );
  assert.deepEqual(
    configuredModerationAdmins({ SITE_OWNER_ACCOUNT: "owner" }),
    [],
  );
  assert.deepEqual(
    configuredModerationAdmins({
      SITE_OWNER_ACCOUNT: "google:owner",
      MODERATION_ADMIN_ACCOUNTS: "google:owner,steam:76561198000000000",
    }),
    ["google:owner", "steam:76561198000000000"],
  );
});
