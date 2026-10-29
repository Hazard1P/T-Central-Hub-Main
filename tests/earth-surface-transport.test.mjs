import test from "node:test";
import assert from "node:assert/strict";
import { Vector3, Quaternion } from "three";
import { WebSocket } from "ws";
import { createRealtimeServer } from "../server/realtime.mjs";
import { signFlightTicket } from "../lib/realtime/tickets.js";
import { PHYSICS_VERSION } from "../lib/physics/mechanics.js";
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
test("WebSocket rejects retired pad actions; service firing preserves cannon alignment", async (t) => {
  const secret = "landing-integration-fixture-secret-0123456789",
    origin = "http://localhost:3700";
  const app = createRealtimeServer({
    secret,
    origins: [origin],
    host: "127.0.0.1",
    port: 0,
  });
  const address = await app.listen();
  t.after(() => app.close());
  const sockets = [];
  t.after(() => sockets.forEach((s) => s.terminate()));
  function packet(socket, predicate) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off("message", message);
        reject(Error("Landing packet timed out"));
      }, 4000);
      function message(raw) {
        const p = JSON.parse(raw.toString());
        if (predicate(p)) {
          clearTimeout(timeout);
          socket.off("message", message);
          resolve(p);
        }
      }
      socket.on("message", message);
    });
  }
  async function join(id) {
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/flight`, {
      origin,
    });
    sockets.push(socket);
    const joined = packet(socket, (p) => p.type === "joined");
    await new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });
    socket.send(
      JSON.stringify({
        type: "join",
        physicsVersion: PHYSICS_VERSION,
        ticket: signFlightTicket({ id }, "landing-live", secret),
      }),
    );
    return { socket, joined: await joined };
  }
  const a = await join("landing-a"),
    b = await join("landing-b");
  const room = app.world.rooms.get("landing-live"),
    pilot = room.players.get("landing-a");
  const before = [...pilot.position];
  const response = packet(
    a.socket,
    (p) => p.type === "landing_result" && p.requestId === "removed-pad",
  );
  a.socket.send(
    JSON.stringify({
      type: "landing",
      revision: 0,
      requestId: "removed-pad",
      action: "land",
      padId: "pacific-1",
      id: "landing-b",
    }),
  );
  assert.equal((await response).status, 410);
  assert.equal(room.players.size, 2);
  assert(!pilot.landedAt);
  pilot.position = [0, 0, 18];
  pilot.velocity = [0, 0, 0];
  const orientation = new Quaternion()
    .setFromAxisAngle(new Vector3(0, 0, 1), 0.4)
    .toArray();
  const shot = await fetch(`http://127.0.0.1:${address.port}/action`, {
    method: "POST",
    headers: {
      authorization: "Bearer " + secret,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      roomName: "landing-live",
      id: "landing-a",
      token: a.joined.token,
      action: {
        type: "fire",
        direction: [0, 0, 1],
        orientation,
        cannonIndex: 1,
        origin: [999, 999, 999],
      },
    }),
  });
  assert.equal(shot.status, 200);
  const expected = new Vector3(1.4, 0.05, 1.4)
    .applyQuaternion(new Quaternion(...orientation))
    .add(new Vector3(...pilot.position))
    .toArray();
  assert.equal(room.shots.at(-1).cannonIndex, 1);
  assert(distance(room.shots.at(-1).origin, expected) < 0.001);
});
