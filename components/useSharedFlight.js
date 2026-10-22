"use client";

import { MULTIPLAYER_POLL_MS } from "@/lib/multiplayerCapacity";
import { useEffect } from "react";
import { useMultiplayerSession } from "@/components/MultiplayerSessionProvider";
import { PHYSICS_VERSION } from "@/lib/physics/mechanics";

const emptyState = {
  players: [],
  projectiles: [],
  playerCount: 0,
  authoritative: false,
};

async function release(session) {
  if (!session?.token) return;
  try {
    await fetch("/api/multiplayer/disconnect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        roomName: session.room,
        id: session.id,
        token: session.token,
      }),
    });
  } catch {}
}

export default function useSharedFlight({
  lobbyMode,
  restartTick = 0,
  roomName,
  identity,
  telemetryRef,
  inputsRef,
  simRuntimeClient,
  gravitySources,
  onCorrection,
  onRespawn,
}) {
  const { setSession, setAuthoritativeState, setServerStatus } =
    useMultiplayerSession();

  useEffect(() => {
    let stopped = false;
    let session = null;
    let timer;
    let failures = 0;
    let socket,
      inputTimer,
      joinTimer,
      revision = 0;
    let roster = new Map();
    let acknowledgedFrame = 0;
    let predictionFrame = null,
      pendingPrediction = null;
    const controller = new AbortController();
    setSession(null);
    setAuthoritativeState(emptyState);
    inputsRef.current = [];
    if (lobbyMode !== "hub") {
      setServerStatus({ connected: false, label: "Solo flight", tick: 0 });
      return;
    }
    setServerStatus({ connected: false, label: "Connecting", tick: 0 });

    // AbortController works on mobile browsers that predate AbortSignal.any/timeout.
    async function post(endpoint, body) {
      const request = new AbortController();
      const abort = () => request.abort();
      controller.signal.addEventListener("abort", abort, { once: true });
      const timeout = window.setTimeout(abort, 8000);
      try {
        const response = await fetch("/api/multiplayer/" + endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: request.signal,
          body: JSON.stringify(body),
        });
        const data = await response.json();
        return { response, data };
      } finally {
        window.clearTimeout(timeout);
        controller.signal.removeEventListener("abort", abort);
      }
    }

    function showIssue(issue) {
      const full = ["ROOM_FULL", "SERVER_FULL"].includes(issue.message);
      const setup = /SETUP_REQUIRED|UNAVAILABLE/.test(issue.message);
      const mismatch = issue.message === "PHYSICS_VERSION_MISMATCH";
      setServerStatus({
        connected: false,
        label: mismatch
          ? "Flight update needed"
          : full
            ? "Server full"
            : setup
              ? "Shared flight unavailable"
              : issue.message === "FLIGHT_REPLACED"
                ? "Flight open elsewhere"
                : "Reconnecting",
        code: issue.message,
        population: issue.population,
        message: mismatch
          ? "Reload this page to update flight. If this message remains, the website and game server need matching deployments."
          : full
            ? "All available pilot slots are occupied. Retrying shortly."
            : setup
              ? "The real-time flight server is unavailable. Retry shortly or return to the hub."
              : issue.message === "FLIGHT_REPLACED"
                ? "This account joined from another connection. Choose Retry now to resume here."
                : "Connection interrupted. Your flight will resume when the shared server responds.",
        tick: 0,
      });
    }
    function reconcile(self, snap = false, utcMs = Date.now()) {
      if (!self?.position || !self?.velocity) return;
      inputsRef.current = snap
        ? []
        : inputsRef.current
            .filter((frame) => frame.frameIndex > self.frameIndex)
            .slice(-120);
      if (snap || self.alive === false) {
        onCorrection({
          position: self.position,
          velocity: self.velocity,
          frameIndex: self.frameIndex,
          snap: true,
        });
        return;
      }
      const prediction = simRuntimeClient.replayAuthoritativeState({
        frames: inputsRef.current,
        authoritativePosition: self.position,
        authoritativeVelocity: self.velocity,
        simulationSeed: roomName,
        gravitySources,
        utcMs,
      });
      const error = Math.hypot(
        ...prediction.position.map(
          (value, index) =>
            value - (telemetryRef.current.position?.[index] || 0),
        ),
      );
      if (error > 0.3) onCorrection(prediction);
    }
    function queuePrediction(self, snap, utcMs) {
      if (snap || self.alive === false) {
        pendingPrediction = null;
        reconcile(self, snap, utcMs);
        return;
      }
      pendingPrediction = { self, utcMs };
      if (predictionFrame !== null) return;
      predictionFrame = window.requestAnimationFrame(() => {
        predictionFrame = null;
        const latest = pendingPrediction;
        pendingPrediction = null;
        if (!stopped && latest) reconcile(latest.self, false, latest.utcMs);
      });
    }
    function openRealtime(data) {
      socket = new WebSocket(data.endpoint);
      const connection = socket;
      let issue = null;
      joinTimer = window.setTimeout(
        () => connection.close(4000, "Join timed out"),
        8000,
      );
      const send = (message) => {
        if (
          connection.readyState === WebSocket.OPEN &&
          connection.bufferedAmount < 65536
        )
          connection.send(JSON.stringify(message));
      };
      connection.onopen = () =>
        send({
          type: "join",
          ticket: data.ticket,
          physicsVersion: PHYSICS_VERSION,
        });
      connection.onerror = () => {}; // close handles reconnects and preserves a single retry timer.
      connection.onmessage = (event) => {
        if (stopped || socket !== connection) return;
        try {
          const packet = JSON.parse(event.data);
          const version =
            packet.type === "state"
              ? packet.state?.physicsVersion
              : packet.physicsVersion;
          if (
            ["joined", "state"].includes(packet.type) &&
            version !== PHYSICS_VERSION
          ) {
            issue = new Error("PHYSICS_VERSION_MISMATCH");
            showIssue(issue);
            connection.close(4003, "Matching flight version required");
            return;
          }
          if (packet.type === "rejected") {
            issue = Object.assign(new Error(packet.error), {
              population: packet.population,
            });
            showIssue(issue);
            return;
          }
          if (packet.type === "joined") {
            window.clearTimeout(joinTimer);
            revision = packet.player.revision;
            acknowledgedFrame = packet.player.frameIndex;
            roster = new Map([[packet.player.id, packet.player]]);
            session = {
              room: packet.room,
              id: packet.player.id,
              token: packet.token,
              displayName: packet.player.displayName,
              transport: "websocket",
              fire: (direction) => send({ type: "fire", direction, revision }),
            };
            setSession(session);
            reconcile(packet.player, true);
            failures = 0;
            inputTimer = window.setInterval(() => {
              const latest = inputsRef.current.at(-1);
              send({
                type: "input",
                revision,
                frameIndex: latest?.frameIndex ?? acknowledgedFrame,
                controlVector: latest?.controlVector || [0, 0, 0],
                direction: telemetryRef.current.direction || [0, 0, 1],
              });
            }, 50);
          }
          if (packet.type === "state" && packet.ok && session) {
            const self = packet.state.players.find(
              (pilot) => pilot.id === session.id,
            );
            if (!self) return;
            const respawned = self.revision !== revision;
            revision = self.revision;
            acknowledgedFrame = self.frameIndex;
            if (packet.token !== session.token) {
              session = { ...session, token: packet.token };
              setSession(session);
            }
            if (packet.fullRoster) roster.clear();
            for (const pilot of packet.state.players)
              roster.set(pilot.id, { ...roster.get(pilot.id), ...pilot });
            setAuthoritativeState({
              ...packet.state,
              players: [...roster.values()],
            });
            setServerStatus({
              connected: true,
              label: "Live",
              transport: "websocket",
              tickRate: packet.state.tickRate,
              population: packet.state.population,
              tick: packet.state.tick,
            });
            queuePrediction(self, respawned, packet.state.physicsUtcMs);
            if (respawned) onRespawn?.();
          }
        } catch {
          connection.close(1008, "Invalid server response");
        }
      };
      connection.onclose = (event) => {
        window.clearTimeout(joinTimer);
        window.clearInterval(inputTimer);
        if (stopped || socket !== connection) return;
        socket = null;
        window.cancelAnimationFrame(predictionFrame);
        predictionFrame = null;
        pendingPrediction = null;
        session = null;
        setSession(null);
        setAuthoritativeState(emptyState);
        inputsRef.current = [];
        const replaced = event.code === 4002;
        showIssue(
          issue || new Error(replaced ? "FLIGHT_REPLACED" : "CONNECTION_LOST"),
        );
        if (!replaced && issue?.message !== "PHYSICS_VERSION_MISMATCH")
          timer = window.setTimeout(
            tick,
            issue ? 5000 : Math.min(10000, 1000 * 2 ** Math.min(failures++, 3)),
          );
      };
    }
    async function tick() {
      try {
        if (!session) {
          const { response, data } = await post("connect", {
            identity,
            roomName,
            mode: "multi_player",
          });
          if (stopped) return;
          if (response.ok && data.ok && data.transport === "websocket") {
            if (data.physicsVersion !== PHYSICS_VERSION)
              throw new Error("PHYSICS_VERSION_MISMATCH");
            openRealtime(data);
            return;
          }
          if (!response.ok || !data.ok || !data.token || !data.player?.id) {
            const issue = new Error(data.error || "JOIN_FAILED");
            issue.population = data.population;
            throw issue;
          }
          session = {
            room: data.room,
            id: data.player.id,
            token: data.token,
            displayName: data.player.displayName,
          };
          if (stopped) {
            void release(session);
            return;
          }
          setSession(session);
          // Rejoin at the server's position rather than publishing a private-world transform.
          inputsRef.current = [];
          onCorrection({
            position: data.player.position,
            velocity: data.player.velocity,
            frameIndex: data.player.frameIndex,
            snap: true,
          });
        }

        const snapshot = {
          ...telemetryRef.current,
          inputs: inputsRef.current
            .slice(0, 72)
            .map(({ frameIndex, dt, controlVector }) => ({
              frameIndex,
              dt,
              controlVector,
            })),
        };
        const { response, data } = await post("state", {
          roomName: session.room,
          id: session.id,
          token: session.token,
          mode: "multi_player",
          snapshot,
        });
        if (stopped) return;
        if (response.status === 401) {
          session = null;
          setSession(null);
          setAuthoritativeState(emptyState);
          throw new Error("session-expired");
        }
        if (!response.ok || !data.ok || !data.state)
          throw new Error("sync-failed");
        failures = 0;
        setAuthoritativeState(data.state);
        setServerStatus({
          connected: true,
          label: "Live",
          durable: Boolean(data.state.durable),
          population: data.state.population,
          tick: data.tick || 0,
        });
        const self = data.state.players?.find(
          (pilot) => pilot.id === session.id,
        );
        if (self?.position && self?.velocity) {
          inputsRef.current = inputsRef.current
            .filter((frame) => frame.frameIndex > self.frameIndex)
            .slice(-120);
          const prediction = simRuntimeClient.replayAuthoritativeState({
            frames: inputsRef.current,
            authoritativePosition: self.position,
            authoritativeVelocity: self.velocity,
            simulationSeed: roomName,
            gravitySources,
          });
          const error = Math.hypot(
            ...prediction.position.map(
              (value, index) =>
                value - (telemetryRef.current.position?.[index] || 0),
            ),
          );
          if (error > 0.3) onCorrection(prediction);
        }
      } catch (issue) {
        if (stopped) return;
        failures += 1;
        showIssue(issue);
        if (issue.message === "PHYSICS_VERSION_MISMATCH") return;
      }
      // One in-flight request, independent of render rate. Slow connections back off.
      if (!stopped)
        timer = window.setTimeout(
          tick,
          failures
            ? Math.min(10000, 1000 * 2 ** Math.min(failures - 1, 4))
            : MULTIPLAYER_POLL_MS,
        );
    }
    void tick();
    const unload = () => {
      if (session?.transport === "websocket")
        socket?.close(1000, "Flight ended");
      else void release(session);
    };
    window.addEventListener("pagehide", unload);
    return () => {
      stopped = true;
      controller.abort();
      window.clearTimeout(timer);
      window.clearTimeout(joinTimer);
      window.clearInterval(inputTimer);
      window.cancelAnimationFrame(predictionFrame);
      pendingPrediction = null;
      socket?.close(1000, "Flight ended");
      window.removeEventListener("pagehide", unload);
      if (session?.transport !== "websocket") void release(session);
    };
  }, [
    lobbyMode,
    restartTick,
    roomName,
    identity,
    telemetryRef,
    inputsRef,
    simRuntimeClient,
    gravitySources,
    onCorrection,
    onRespawn,
    setSession,
    setAuthoritativeState,
    setServerStatus,
  ]);
}
