import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createRealtimeServer } from "../server/realtime.mjs";
import { signFlightTicket } from "../lib/realtime/tickets.js";
import { PHYSICS_VERSION } from "../lib/physics/mechanics.js";
import { earthSurfacePoint } from "../lib/earthSurface.js";
import {
  earthAnchorAt,
  earthPointVelocity,
  earthAnchorDistance,
  METRES_PER_UNIT,
} from "../lib/earthWalk.js";
test("real shared clients land, walk, see peer modes, reject forged controls and board the same ship", async (t) => {
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
    pilot = room.players.get("landing-a"),
    other = room.players.get("landing-b");
  const utcMs = Date.now(),
    position = earthSurfacePoint(25, 15, 4, utcMs);
  pilot.position = position;
  pilot.velocity = earthPointVelocity(earthAnchorAt(position, utcMs), 4, utcMs);
  async function action(socket, action, sequence, requestId, extra = {}) {
    const response = packet(
      socket,
      (p) => p.type === "surface_result" && p.requestId === requestId,
    );
    socket.send(
      JSON.stringify({
        type: "surface",
        revision: 0,
        action,
        movementSequence: sequence,
        requestId,
        ...extra,
      }),
    );
    return response;
  }
  const result = await action(a.socket, "walk", 0, "walk-1", {
    id: "landing-b",
    position: [0, 0, 0],
    walkAnchor: [1, 0, 0],
  });
  assert(result.ok);
  assert.equal(result.player.movementMode, "walk");
  assert.equal(result.player.movementSequence, 1);
  assert.notEqual(other.movementMode, "walk");
  assert(pilot.parkedShip);
  assert(pilot.walkAnchor);
  assert(pilot.safeZone);
  const visible = await packet(
    b.socket,
    (p) =>
      p.type === "state" &&
      p.state.players.some(
        (x) => x.id === "landing-a" && x.movementMode === "walk",
      ),
  );
  const peer = visible.state.players.find((p) => p.id === "landing-a");
  assert(peer.walkAnchor);
  assert(peer.parkedShip);
  a.socket.send(
    JSON.stringify({
      type: "input",
      revision: 0,
      frameIndex: 1,
      movementSequence: 0,
      controlVector: [100, 100, 100],
      direction: [0, 0, 1],
    }),
  );
  await new Promise((r) => setTimeout(r, 80));
  assert.deepEqual(pilot.control, [0, 0, 0]);
  const initial = [...pilot.walkAnchor];
  a.socket.send(
    JSON.stringify({
      type: "input",
      revision: 0,
      frameIndex: 2,
      movementSequence: 1,
      controlVector: [1, 0, 1],
      direction: [0, 0, 1],
    }),
  );
  await packet(
    a.socket,
    (p) =>
      p.type === "state" &&
      p.state.players.some((x) => x.id === "landing-a" && x.frameIndex === 2),
  );
  assert(earthAnchorDistance(initial, pilot.walkAnchor) * METRES_PER_UNIT < 1);
  const actual = [...pilot.walkAnchor],
    parked = pilot.parkedShip;
  pilot.walkAnchor = earthAnchorAt(earthSurfacePoint(25.01, 15, 0));
  pilot.control = [0, 0, 0];
  assert.equal((await action(a.socket, "board", 1, "too-far")).status, 409);
  assert.equal(pilot.movementMode, "walk");
  pilot.walkAnchor = actual;
  const boarded = await action(a.socket, "board", 1, "board-1");
  assert(boarded.ok);
  assert.equal(boarded.player.movementMode, "ship");
  assert.equal(boarded.player.movementSequence, 2);
  assert.equal(pilot.token, a.joined.token);
  assert.equal(room.players.size, 2);
  assert.equal(pilot.walkAnchor, null);
  assert.equal(pilot.parkedShip, null);
  assert.equal((await action(a.socket, "walk", 0, "stale")).status, 409);
  assert.equal(pilot.movementMode, "ship");
});
