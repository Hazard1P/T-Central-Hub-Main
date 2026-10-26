import test from "node:test";
import assert from "node:assert/strict";
import { fetchWithTimeout } from "../lib/fetchWithTimeout.js";
import { createRequestId } from "../lib/requestId.js";

test("mobile requests work without AbortSignal.timeout or AbortSignal.any", async (t) => {
  const original = globalThis.fetch,
    timeout = AbortSignal.timeout,
    any = AbortSignal.any;
  t.after(() => {
    globalThis.fetch = original;
    AbortSignal.timeout = timeout;
    AbortSignal.any = any;
  });
  AbortSignal.timeout = undefined;
  AbortSignal.any = undefined;
  globalThis.fetch = async (input, init) => {
    assert.equal(input, "/session");
    assert.equal(init.signal.aborted, false);
    return Response.json({ ok: true });
  };
  const response = await fetchWithTimeout("/session");
  assert.deepEqual(await response.json(), { ok: true });
});

test("the compatible request helper relays caller cancellation", async (t) => {
  const original = globalThis.fetch;
  t.after(() => (globalThis.fetch = original));
  globalThis.fetch = (input, init) =>
    new Promise((resolve, reject) => {
      init.signal.addEventListener(
        "abort",
        () => reject(new DOMException("Stopped", "AbortError")),
        { once: true },
      );
    });
  const controller = new AbortController(),
    request = fetchWithTimeout("/cancelled", { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, (e) => e.name === "AbortError");
});

test("the compatible request helper times out a stuck request", async (t) => {
  const original = globalThis.fetch;
  t.after(() => (globalThis.fetch = original));
  globalThis.fetch = (input, init) =>
    new Promise((resolve, reject) => {
      init.signal.addEventListener(
        "abort",
        () => reject(new DOMException("Timed out", "AbortError")),
        { once: true },
      );
    });
  await assert.rejects(
    fetchWithTimeout("/stuck", {}, 10),
    (e) => e.name === "AbortError",
  );
});

test("secure receipt IDs remain valid and distinct when randomUUID is unavailable", () => {
  const cryptoWithoutUuid = {
    getRandomValues: (array) => crypto.getRandomValues(array),
  };
  const a = createRequestId(cryptoWithoutUuid),
    b = createRequestId(cryptoWithoutUuid);
  assert.match(
    a,
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
  );
  assert.notEqual(a, b);
});
