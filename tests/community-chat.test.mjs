import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import {
  signChatTicket,
  verifyChatTicket,
} from "../lib/realtime/chatTickets.js";
import {
  signFlightTicket,
  verifyFlightTicket,
} from "../lib/realtime/tickets.js";
import {
  createCommunityChatRepository,
  publicChatMessage,
} from "../lib/server/communityChatRepository.js";
import { createRealtimeServer } from "../server/realtime.mjs";
const secret = "community-chat-secret-for-test-".repeat(2),
  origin = "http://localhost:3000";
const identity = {
  id: "google:pilot",
  displayName: "Pilot",
  identityKind: "google",
  authenticated: true,
};
const packet = (socket, type) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", listener);
      reject(Error("Missing " + type));
    }, 5000);
    function listener(raw) {
      const item = JSON.parse(raw);
      if (item.type === type) {
        clearTimeout(timer);
        socket.off("message", listener);
        resolve(item);
      }
    }
    socket.on("message", listener);
  });
async function connect(port, who = identity) {
  const socket = new WebSocket("ws://127.0.0.1:" + port + "/chat", { origin });
  await once(socket, "open");
  const ready = packet(socket, "ready");
  socket.send(
    JSON.stringify({ type: "join", ticket: signChatTicket(who, secret) }),
  );
  await ready;
  return socket;
}
test("chat tickets reject expiry, tampering and cross-protocol flight credentials", () => {
  const ticket = signChatTicket(identity, secret, 1000);
  assert.equal(
    verifyChatTicket(ticket, secret, 1001).identity.id,
    "google:pilot",
  );
  assert.throws(() => verifyChatTicket(ticket, secret, 31000));
  assert.throws(() => verifyChatTicket(ticket + "x", secret, 1001));
  assert.throws(() =>
    verifyChatTicket(
      signFlightTicket(identity, "shared", secret, 1000),
      secret,
      1001,
    ),
  );
  assert.throws(() => verifyFlightTicket(ticket, secret, 1001));
});
test("chat storage rejects guests and unsafe lengths; public messages exclude private identity and moderation fields", async () => {
  const message = {
    id: randomUUID(),
    displayName: "Pilot",
    provider: "google",
    body: "Hello",
    createdAt: new Date().toISOString(),
    author_key: "google:private",
    hidden_at: null,
  };
  const admin = {
    rpc(name, args) {
      return {
        abortSignal: async () => ({
          data:
            name === "community_chat_history"
              ? { ok: true, messages: [message] }
              : { ok: true, message },
        }),
      };
    },
  };
  const store = createCommunityChatRepository(admin);
  assert.deepEqual(Object.keys(publicChatMessage(message)).sort(), [
    "body",
    "createdAt",
    "displayName",
    "id",
    "provider",
  ]);
  await assert.rejects(store.post({ authenticated: false }, "Hello"), {
    status: 401,
  });
  await assert.rejects(store.post(identity, " "), { status: 400 });
  await assert.rejects(store.post(identity, "a".repeat(501)), { status: 400 });
  assert(!JSON.stringify(await store.history()).includes("google:private"));
  assert.equal((await store.post(identity, " Hello ")).message.body, "Hello");
  await assert.rejects(createCommunityChatRepository(null).history(), {
    status: 503,
  });
});
test("real chat sockets broadcast without creating a ship, reject guest sends, enforce bans and refresh hidden messages", async (t) => {
  let bans = [],
    messages = [];
  const store = {
    history: async () => ({ ok: true, messages: [...messages] }),
    post: async (who, body) => {
      const message = {
        id: randomUUID(),
        displayName: who.displayName,
        provider: who.identityKind,
        body,
        createdAt: new Date().toISOString(),
      };
      messages.push(message);
      return { ok: true, message };
    },
  };
  const app = createRealtimeServer({
    secret,
    origins: [origin],
    port: 0,
    host: "127.0.0.1",
    checkAccess: async () => ({ ok: true, bans }),
    chatStore: store,
    moderationIntervalMs: 60000,
  });
  const address = await app.listen();
  t.after(() => app.close());
  const a = await connect(address.port),
    b = await connect(address.port, {
      id: "steam:76561198000000000",
      displayName: "Steam Pilot",
      identityKind: "steam",
      authenticated: true,
    }),
    guest = await connect(address.port, {
      id: "guest-reader",
      displayName: "Visitor",
      identityKind: "guest",
      authenticated: false,
    });
  t.after(() => {
    a.terminate();
    b.terminate();
    guest.terminate();
  });
  assert.equal(
    app.world.rooms.size,
    0,
    "chat must never join or replace a flight",
  );
  await fetch("http://127.0.0.1:" + address.port + "/chat-moderation", {
    method: "POST",
    headers: { authorization: "Bearer " + secret },
    body: "{}",
  });
  const received = packet(b, "message"),
    visitor = packet(guest, "message"),
    ack = packet(a, "sent");
  a.send(
    JSON.stringify({
      type: "message",
      body: "Hello <script>world</script>",
      requestId: "one",
    }),
  );
  assert.equal((await received).message.body, "Hello <script>world</script>");
  assert.equal((await visitor).message.displayName, "Pilot");
  assert.equal((await ack).requestId, "one");
  const denied = packet(guest, "error");
  guest.send(JSON.stringify({ type: "message", body: "Anonymous spam" }));
  assert.equal((await denied).status, 401);
  messages = [];
  const refreshed = packet(b, "history");
  const result = await fetch(
    "http://127.0.0.1:" + address.port + "/chat-moderation",
    {
      method: "POST",
      headers: { authorization: "Bearer " + secret },
      body: "{}",
    },
  );
  assert.equal(result.status, 200);
  assert.deepEqual((await refreshed).messages, []);
  const banned = packet(a, "rejected");
  bans = [
    { account_key: "google:pilot", reason: "Reviewed abuse", expires_at: null },
  ];
  const kicked = await fetch(
    "http://127.0.0.1:" + address.port + "/moderation",
    {
      method: "POST",
      headers: { authorization: "Bearer " + secret },
      body: JSON.stringify({ id: "google:pilot" }),
    },
  );
  assert.equal(kicked.status, 200);
  assert.equal((await banned).error, "ACCOUNT_BANNED");
  const replay = new WebSocket("ws://127.0.0.1:" + address.port + "/chat", {
    origin,
  });
  t.after(() => replay.terminate());
  await once(replay, "open");
  const reject = packet(replay, "rejected");
  replay.send(
    JSON.stringify({ type: "join", ticket: signChatTicket(identity, secret) }),
  );
  assert.equal((await reject).error, "ACCOUNT_BANNED");
  bans = [];
  const returned = await connect(address.port);
  returned.terminate();
});
