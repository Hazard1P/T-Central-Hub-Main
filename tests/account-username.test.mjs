import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGamertag } from "../lib/accountUsername.js";
import { defaultGoogleUsername } from "../lib/server/usernameDefaults.js";
import { createAccountUsernameRepository } from "../lib/server/accountUsernameRepository.js";
import { buildHubPostRecord, publicHubPost } from "../lib/hubPosts.js";
const auth = {
  authenticated: true,
  provider: "google",
  accountId: "private-google-sub",
  googleUser: { sub: "private-google-sub", name: "Private Legal Name" },
};

test("Google gamertags normalize compatibility characters and reject unsafe or unsupported names", () => {
  assert.equal(normalizeGamertag("  Orbit_Pilot-7  "), "Orbit_Pilot-7");
  assert.equal(normalizeGamertag("Ｏｒｂｉｔ"), "Orbit");
  for (const value of [
    null,
    12,
    "ab",
    "a".repeat(25),
    "_pilot",
    "space pilot",
    "pilot@example.com",
    "<script>",
    "a\nname",
  ])
    assert.throws(() => normalizeGamertag(value));
});

test("default Google tags are stable, valid and avoid exposing subject or real name", () => {
  const tag = defaultGoogleUsername(auth.accountId);
  assert.equal(tag, defaultGoogleUsername(auth.accountId));
  assert.notEqual(tag, defaultGoogleUsername("another-subject"));
  assert.equal(normalizeGamertag(tag), tag);
  assert(!tag.includes(auth.accountId));
});

test("repository mutations bind only verified provider/account and carry no caller timestamp", async () => {
  let sent;
  const admin = {
    rpc(name, args) {
      sent = { name, args };
      return {
        abortSignal: async () => ({
          data: {
            ok: true,
            username: args.p_username,
            ownerKey: "google:" + auth.accountId,
          },
        }),
      };
    },
  };
  const repo = createAccountUsernameRepository(admin);
  await repo.update(
    { ...auth, now: 0, owner: "google:someone-else" },
    "  Orbit_7  ",
  );
  assert.deepEqual(sent, {
    name: "account_username",
    args: {
      p_provider: "google",
      p_account_id: auth.accountId,
      p_default: defaultGoogleUsername(auth.accountId),
      p_username: "Orbit_7",
    },
  });
  await assert.rejects(
    () =>
      repo.update(
        {
          ...auth,
          provider: "steam",
          steamUser: { personaname: "Official Steam 🎮" },
        },
        "FakeName",
      ),
    (e) => e.status === 403,
  );
  await assert.rejects(
    () => repo.update({ ...auth, authenticated: false }, "FakeName"),
    (e) => e.status === 401,
  );
  await assert.rejects(
    () => createAccountUsernameRepository(null).update(auth, "Orbit_7"),
    (e) => e.status === 503,
  );
});

test("repository preserves durable cooldown and uniqueness failures without retrying a write", async () => {
  for (const code of ["USERNAME_COOLDOWN", "USERNAME_TAKEN"]) {
    let calls = 0;
    const repo = createAccountUsernameRepository({
      rpc() {
        calls++;
        return {
          abortSignal: async () => ({
            data: {
              ok: false,
              error: code,
              nextChangeAt: "2026-11-27T00:00:00Z",
            },
          }),
        };
      },
    });
    await assert.rejects(
      () => repo.update(auth, "Orbit_7"),
      (e) => e.status === 409 && e.code === code,
    );
    assert.equal(calls, 1);
  }
});

test("new board posts use the account gamertag while retaining the private author binding", () => {
  const { record } = buildHubPostRecord({
    auth: {
      ...auth,
      displayName: "Orbit_7",
      googleUser: { ...auth.googleUser, gamertag: "Orbit_7" },
    },
    body: { topic: "Explore", message: "Ready to fly" },
  });
  const visible = publicHubPost(record);
  assert.equal(visible.author.displayName, "Orbit_7");
  assert.equal(record.author.accountId, auth.accountId);
  assert.doesNotMatch(
    JSON.stringify(visible),
    /Private Legal Name|private-google-sub/,
  );
});
