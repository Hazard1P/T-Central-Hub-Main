// Synthetic loopback benchmark, never evidence of production or mobile capacity.
import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createRealtimeServer } from "../server/realtime.mjs";
import { signFlightTicket } from "../lib/realtime/tickets.js";
const capacity = 128,
  secret = "local-benchmark-only-secret-not-for-deployment",
  origin = "http://localhost:3700";
const app = createRealtimeServer({
  secret,
  origins: [origin],
  capacity,
  port: 0,
  host: "127.0.0.1",
});
const address = await app.listen(),
  sockets = [],
  samples = [],
  counts = [],
  bytes = [];
let sending,
  ended = false;
try {
  async function join(i) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${address.port}/flight`, {
        origin,
      });
      sockets[i] = socket;
      counts[i] = 0;
      bytes[i] = 0;
      const timeout = setTimeout(() => reject(Error("join timeout")), 5000);
      socket.on("error", reject);
      socket.on("open", () =>
        socket.send(
          JSON.stringify({
            type: "join",
            ticket: signFlightTicket({ id: "pilot-" + i }, "benchmark", secret),
          }),
        ),
      );
      socket.on("message", (raw) => {
        const packet = JSON.parse(raw);
        if (packet.type === "joined") {
          clearTimeout(timeout);
          resolve(packet);
        }
        if (packet.type === "rejected") {
          clearTimeout(timeout);
          resolve(packet);
        }
        if (packet.type === "state" && !ended) {
          counts[i]++;
          bytes[i] += raw.length;
          if (packet.fullRoster) assert.equal(packet.state.players.length, 128);
          if (packet.state.tick > 0) samples.push(performance.now());
        }
      });
    });
  }
  for (let offset = 0; offset < capacity; offset += 32)
    await Promise.all(Array.from({ length: 32 }, (_, j) => join(offset + j)));
  const rejected = await join(128);
  assert.equal(rejected.error, "ROOM_FULL");
  sockets[128].terminate();
  let frame = 0;
  const start = performance.now(),
    startTick = app.world.tickIndex;
  sending = setInterval(() => {
    frame++;
    for (let i = 0; i < capacity; i++)
      if (sockets[i].readyState === WebSocket.OPEN) {
        const player = app.world.rooms
          .get("benchmark")
          .players.get("pilot-" + i);
        sockets[i].send(
          JSON.stringify({
            type: "input",
            revision: player.revision,
            frameIndex: frame,
            controlVector: [((i % 3) - 1) * 0.15, 0, 0],
            direction: [0, 0, 1],
          }),
        );
        if (frame % 5 === 0)
          sockets[i].send(
            JSON.stringify({
              type: "fire",
              revision: player.revision,
              direction: [0, 0, 1],
            }),
          );
      }
  }, 50);
  await new Promise((resolve) =>
    setTimeout(
      resolve,
      Math.max(
        5,
        Math.min(60, Number(process.env.REALTIME_TEST_SECONDS) || 5),
      ) * 1000,
    ),
  );
  ended = true;
  clearInterval(sending);
  const elapsed = performance.now() - start,
    ticks = app.world.tickIndex - startTick;
  assert(
    counts.slice(0, 128).every((count) => count >= 25),
    "every admitted pilot must receive continuous snapshots",
  );
  console.log(
    JSON.stringify(
      {
        transport: "WebSocket",
        clients: 128,
        overflowRejected: true,
        durationSeconds: Number((elapsed / 1000).toFixed(2)),
        simulationHz: Number((ticks / (elapsed / 1000)).toFixed(1)),
        minSnapshots: Math.min(...counts.slice(0, 128)),
        maxSnapshots: Math.max(...counts.slice(0, 128)),
        decodedMiB: Number(
          (bytes.reduce((sum, n) => sum + n, 0) / 1024 / 1024).toFixed(2),
        ),
        wireMiB: Number(
          (
            sockets
              .slice(0, 128)
              .reduce(
                (sum, socket) => sum + (socket._socket?.bytesRead || 0),
                0,
              ) /
            1024 /
            1024
          ).toFixed(2),
        ),
        productionCapacityVerified: false,
      },
      null,
      2,
    ),
  );
} finally {
  clearInterval(sending);
  for (const socket of sockets) socket.terminate();
  await app.close();
}
