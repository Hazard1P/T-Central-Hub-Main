import { WebSocketServer, WebSocket } from "ws";
import { verifyChatTicket } from "../lib/realtime/chatTickets.js";
import { banDenial, ACCOUNT_KEY_PATTERN } from "../lib/moderation.js";
export function createCommunityChat({
  secret,
  origins,
  checkAccess,
  store,
  capacity = 256,
  intervalMs = 5000,
}) {
  const sockets = new WebSocketServer({
      noServer: true,
      maxPayload: 4096,
      perMessageDeflate: false,
    }),
    clients = new Set();
  let checking = false,
    lastHistory = "",
    operations = Promise.resolve();
  const exclusive = (work) => {
    const next = operations.then(work);
    operations = next.catch(() => {});
    return next;
  };
  const send = (socket, body) => {
    if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 250000)
      socket.send(JSON.stringify(body));
    else if (socket.bufferedAmount >= 250000)
      socket.close(1013, "Connection too slow");
  };
  const broadcast = (body) => {
    for (const socket of clients) if (socket.identity) send(socket, body);
  };
  const access = async (ids) => {
    try {
      return await checkAccess(ids);
    } catch {
      return { ok: false };
    }
  };
  function applyAccess(ids, result) {
    for (const socket of clients)
      if (ids.includes(socket.identity?.id)) {
        const denied = banDenial(result, socket.identity.id);
        if (!denied.ok) {
          send(socket, { type: "rejected", ...denied });
          socket.close(4004, denied.error);
        }
      }
  }
  async function refreshHistory() {
    return exclusive(async () => {
      const history = await store.history(),
        signature = JSON.stringify(history.messages);
      if (signature !== lastHistory) {
        lastHistory = signature;
        broadcast({ type: "history", messages: history.messages });
      }
      return history;
    });
  }
  sockets.on("connection", (socket) => {
    clients.add(socket);
    socket.alive = true;
    socket.messageCount = 0;
    socket.windowStart = Date.now();
    const timeout = setTimeout(() => {
      if (!socket.identity) socket.close(1008, "Chat ticket required");
    }, 5000);
    socket.on("pong", () => {
      socket.alive = true;
    });
    socket.on("message", async (raw) => {
      if (Date.now() - socket.windowStart >= 1000) {
        socket.windowStart = Date.now();
        socket.messageCount = 0;
      }
      if (++socket.messageCount > 20) {
        socket.close(1008, "Message rate exceeded");
        return;
      }
      try {
        const data = JSON.parse(raw.toString());
        if (!socket.identity) {
          if (socket.joining) return;
          if (data.type !== "join") throw Error("Join first");
          socket.joining = true;
          const ticket = verifyChatTicket(data.ticket, secret),
            denial = banDenial(
              await access([ticket.identity.id]),
              ticket.identity.id,
            );
          if (!denial.ok) {
            send(socket, { type: "rejected", ...denial });
            socket.close(4004, denial.error);
            return;
          }
          await exclusive(async () => {
            const history = await store.history();
            if (socket.readyState !== WebSocket.OPEN) return;
            socket.identity = ticket.identity;
            clearTimeout(timeout);
            send(socket, {
              type: "ready",
              messages: history.messages,
              canSend: ticket.identity.authenticated === true,
            });
          });
          return;
        }
        if (data.type !== "message") return;
        if (socket.posting) {
          send(socket, {
            type: "error",
            error: "Please wait for your previous message.",
            requestId: data.requestId,
          });
          return;
        }
        socket.posting = true;
        try {
          if (
            !socket.identity.authenticated ||
            !ACCOUNT_KEY_PATTERN.test(socket.identity.id)
          )
            throw Object.assign(
              new Error("Sign in with Google or Steam to send messages."),
              { status: 401 },
            );
          const accessResult = await access([socket.identity.id]),
            denial = banDenial(accessResult, socket.identity.id);
          if (!denial.ok) {
            applyAccess([socket.identity.id], accessResult);
            return;
          }
          await exclusive(async () => {
            const result = await store.post(socket.identity, data.body);
            // A later hide must invalidate history even when it returns to the
            // same set of IDs that preceded this newly broadcast message.
            lastHistory = null;
            broadcast({ type: "message", message: result.message });
            send(socket, { type: "sent", requestId: data.requestId });
          });
        } catch (error) {
          send(socket, {
            type: "error",
            error: error.message,
            status: error.status || 503,
            requestId: data.requestId,
          });
        } finally {
          socket.posting = false;
        }
      } catch (error) {
        send(socket, {
          type: "error",
          error: error.status
            ? error.message
            : "Chat connection could not be established.",
          status: error.status || 400,
        });
        if (!socket.identity) socket.close(1008, "Chat unavailable");
      }
    });
    socket.on("error", () => {});
    socket.on("close", () => {
      clearTimeout(timeout);
      clients.delete(socket);
    });
  });
  const timer = setInterval(
    async () => {
      if (checking || !clients.size) return;
      checking = true;
      try {
        const ids = [
          ...new Set(
            [...clients]
              .map((socket) => socket.identity?.id)
              .filter((id) => ACCOUNT_KEY_PATTERN.test(id)),
          ),
        ];
        if (ids.length) applyAccess(ids, await access(ids));
        await refreshHistory();
      } catch {
        broadcast({
          type: "notice",
          error:
            "Chat refresh is unavailable. Previously loaded messages remain visible.",
        });
      } finally {
        checking = false;
      }
    },
    Math.max(100, intervalMs),
  );
  const heartbeat = setInterval(() => {
    for (const socket of clients) {
      if (!socket.alive) {
        socket.terminate();
        continue;
      }
      socket.alive = false;
      socket.ping();
    }
  }, 10000);
  return {
    handleUpgrade(req, socket, head) {
      if (!origins.includes(req.headers.origin) || clients.size >= capacity) {
        socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      sockets.handleUpgrade(req, socket, head, (ws) =>
        sockets.emit("connection", ws),
      );
    },
    applyAccess,
    updateIdentity(id, displayName) {
      if (
        !ACCOUNT_KEY_PATTERN.test(id) ||
        typeof displayName !== "string" ||
        !displayName.trim()
      )
        return;
      for (const socket of clients)
        if (socket.identity?.id === id)
          socket.identity = {
            ...socket.identity,
            displayName: displayName
              .replace(/[\x00-\x1f\x7f]/g, "")
              .slice(0, 160),
          };
    },
    refreshHistory,
    async close() {
      clearInterval(timer);
      clearInterval(heartbeat);
      for (const socket of clients) socket.terminate();
      await new Promise((resolve) => sockets.close(resolve));
    },
  };
}
