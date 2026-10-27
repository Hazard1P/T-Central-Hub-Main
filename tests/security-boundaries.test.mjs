import {
  requiresRealtimeServer,
  hasRealtimeServer,
} from "../lib/server/realtimeBridge.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  readJsonBounded,
  safeSecretMatches,
  isMaintenanceRequest,
} from "../lib/server/requestSecurity.js";
import {
  verifiedProgressIdentity,
  mergeClientDiscoveries,
} from "../lib/server/accountProgressionPolicy.js";
import {
  privateSeedCipher,
  createPrivateSeedCipher,
  privateSeedCipherFromEnvironment,
} from "../lib/server/privateSeedCipher.js";
import { createPrayerSeedRepository } from "../lib/server/prayerSeedRepository.js";
const require = createRequire(import.meta.url),
  { securityHeaders } = require("../lib/securityHeaders.cjs");
test("bounded JSON reads reject oversized declared and chunked bodies", async () => {
  const good = new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({ hello: "world" }),
  });
  assert.deepEqual(await readJsonBounded(good), { hello: "world" });
  await assert.rejects(
    readJsonBounded(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-length": "9999" },
        body: "{}",
      }),
      100,
    ),
    { status: 413 },
  );
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(101));
      controller.close();
    },
  });
  await assert.rejects(
    readJsonBounded(
      new Request("http://localhost", { method: "POST", duplex: "half", body }),
      100,
    ),
    { status: 413 },
  );
  await assert.rejects(
    readJsonBounded(
      new Request("http://localhost", { method: "POST", body: "invalid" }),
    ),
    { status: 400 },
  );
});
test("maintenance credentials fail closed when missing, short, malformed or incorrect", () => {
  const saved = process.env.MAINTENANCE_API_SECRET;
  delete process.env.MAINTENANCE_API_SECRET;
  delete process.env.CRON_SECRET;
  assert(!isMaintenanceRequest(new Request("http://localhost")));
  const secret = "maintenance-test-secret-".repeat(3);
  process.env.MAINTENANCE_API_SECRET = secret;
  assert(
    isMaintenanceRequest(
      new Request("http://localhost", {
        headers: { authorization: "Bearer " + secret },
      }),
    ),
  );
  assert(!safeSecretMatches("é".repeat(secret.length), secret));
  assert(!safeSecretMatches("", ""));
  assert(!safeSecretMatches("short", "short"));
  if (saved === undefined) delete process.env.MAINTENANCE_API_SECRET;
  else process.env.MAINTENANCE_API_SECRET = saved;
});
test("progress identity is verified and client discoveries cannot mint credits, VIP or rewards", () => {
  assert.throws(
    () =>
      verifiedProgressIdentity({
        authenticated: false,
        provider: "google",
        accountId: "victim",
      }),
    { status: 401 },
  );
  assert.equal(
    verifiedProgressIdentity({
      authenticated: true,
      provider: "google",
      accountId: "owner",
    }).id,
    "google:owner",
  );
  const merged = mergeClientDiscoveries(
    { credits: 12, vipTier: "standard", routeTrips: 1 },
    {
      credits: 999999,
      vipTier: "god",
      vipXpBoost: 99,
      routeTrips: 999,
      visitedNodes: ["earth", "<script>"],
    },
  );
  assert.equal(merged.credits, 12);
  assert.equal(merged.vipTier, "standard");
  assert.equal(merged.routeTrips, 1);
  assert(merged.visitedNodes.includes("earth"));
  assert(!merged.visitedNodes.includes("<script>"));
});
test("private seed storage encrypts text, authenticates owner metadata and survives key rotation", async () => {
  const oldKey = Buffer.alloc(32, 4),
    cipher = createPrivateSeedCipher({
      keys: { one: oldKey },
      activeKeyId: "one",
    }),
    folder = await mkdtemp(path.join(os.tmpdir(), "encrypted-seeds-"));
  const localPath = path.join(folder, "vault.json");
  const auth = { authenticated: true, provider: "google", accountId: "owner" },
    input = {
      body: "Private seed words that must stay encrypted",
      requestId: "request-encryption-0001",
      flightSignature: "shared:halcyon",
    };
  try {
    const repo = createPrayerSeedRepository({ localPath, cipher });
    const saved = await repo.save(auth, input);
    assert.equal(saved.seed.body, input.body);
    const file = await readFile(localPath, "utf8");
    assert(!file.includes(input.body));
    const stored = JSON.parse(file).seeds[0];
    assert.equal(stored.body, "[encrypted]");
    assert.equal(stored.binding_hash, saved.seed.binding_hash);
    assert.match(stored.body_ciphertext, /^v3\.one\./);
    assert.throws(() =>
      cipher.reveal({ ...stored, account_key: "google:victim" }),
    );
    assert.throws(() =>
      cipher.reveal({ ...stored, flight_signature: "changed" }),
    );
    assert.throws(() =>
      cipher.reveal({ ...stored, binding_hash: "0".repeat(64) }),
    );
    const rotated = createPrivateSeedCipher({
        keys: { one: oldKey, two: Buffer.alloc(32, 9) },
        activeKeyId: "two",
      }),
      restarted = createPrayerSeedRepository({ localPath, cipher: rotated });
    assert.equal((await restarted.load(auth)).seeds[0].body, input.body);
    assert.equal((await restarted.save(auth, input)).duplicate, true);
    assert.throws(() => privateSeedCipherFromEnvironment({}));
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
test("security headers protect framing, MIME handling and referrers without breaking local HTTP", () => {
  const local = securityHeaders();
  assert.equal(local.find((h) => h.key === "X-Frame-Options").value, "DENY");
  assert(!local.some((h) => h.key === "Strict-Transport-Security"));
  assert(
    securityHeaders({ https: true }).some(
      (h) => h.key === "Strict-Transport-Security",
    ),
  );
  assert(
    local
      .find((h) => h.key === "Content-Security-Policy")
      .value.includes("object-src 'none'"),
  );
});

test("application private storage refuses new plaintext writes when data keys are missing", async () => {
  const previous = process.env.DATA_ENCRYPTION_KEYS,
    previousId = process.env.DATA_ENCRYPTION_KEY_ID;
  delete process.env.DATA_ENCRYPTION_KEYS;
  delete process.env.DATA_ENCRYPTION_KEY_ID;
  const folder = await mkdtemp(path.join(os.tmpdir(), "missing-seed-key-")),
    localPath = path.join(folder, "vault.json");
  try {
    const repository = createPrayerSeedRepository({
      localPath,
      cipher: privateSeedCipher,
    });
    await assert.rejects(
      repository.save(
        { authenticated: true, provider: "google", accountId: "owner" },
        {
          body: "Do not write plaintext",
          requestId: "missing-key-request",
          flightSignature: "shared:halcyon",
        },
      ),
      { status: 503 },
    );
    await assert.rejects(readFile(localPath), { code: "ENOENT" });
  } finally {
    if (previous === undefined) delete process.env.DATA_ENCRYPTION_KEYS;
    else process.env.DATA_ENCRYPTION_KEYS = previous;
    if (previousId === undefined) delete process.env.DATA_ENCRYPTION_KEY_ID;
    else process.env.DATA_ENCRYPTION_KEY_ID = previousId;
    await rm(folder, { recursive: true, force: true });
  }
});

test("production cannot fall back to client-authoritative HTTP flight or public cleartext sockets", () => {
  const names = [
      "NODE_ENV",
      "MULTIPLAYER_TRANSPORT",
      "REALTIME_SERVER_URL",
      "NEXT_PUBLIC_REALTIME_WS_URL",
      "REALTIME_SERVER_SECRET",
    ],
    previous = Object.fromEntries(
      names.map((name) => [name, process.env[name]]),
    );
  try {
    process.env.NODE_ENV = "production";
    process.env.MULTIPLAYER_TRANSPORT = "http";
    assert(requiresRealtimeServer());
    process.env.REALTIME_SERVER_URL = "https://service.example.invalid";
    process.env.NEXT_PUBLIC_REALTIME_WS_URL =
      "ws://public.example.invalid/flight";
    process.env.REALTIME_SERVER_SECRET =
      "strong-test-only-service-secret-".repeat(2);
    assert(!hasRealtimeServer());
    process.env.NEXT_PUBLIC_REALTIME_WS_URL =
      "wss://public.example.invalid/flight";
    assert(hasRealtimeServer());
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
