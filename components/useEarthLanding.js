"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getEarthSurfaceStatus,
  getEarthLandingPad,
  validateEarthLanding,
  takeoffEarthPose,
} from "@/lib/earthLanding";
import { isInteractiveTarget } from "@/lib/flightInput";

export default function useEarthLanding({
  session,
  shared,
  self,
  players,
  telemetry,
  utcMs,
  getPhysicsTime = Date.now,
  roomName,
  spawnTick,
  onStop,
  onTakeoff,
  enabled = true,
}) {
  const [localPad, setLocalPad] = useState(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const inFlight = useRef(false),
    generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setLocalPad(null);
    setPending(false);
    setError("");
    inFlight.current = false;
    return () => {
      generation.current++;
    };
  }, [roomName, shared, spawnTick]);
  const landedAt = shared ? self?.landedAt : localPad;
  const status = useMemo(
    () =>
      getEarthSurfaceStatus(
        telemetry.position,
        telemetry.velocity,
        utcMs || Date.now(),
        (players || [])
          .filter((p) => p.id !== self?.id)
          .map((p) => p.landedAt)
          .filter(Boolean),
      ),
    [telemetry.position, telemetry.velocity, utcMs, players, self?.id],
  );
  const pad = landedAt
    ? getEarthLandingPad(landedAt, utcMs || Date.now())
    : status.nearest;
  const act = useCallback(async () => {
    if (inFlight.current || self?.alive === false || !enabled) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    const current = generation.current;
    try {
      const action = landedAt ? "takeoff" : "land";
      if (shared) {
        if (!session?.requestLanding)
          throw Error("Connect to shared flight before landing.");
        await session.requestLanding(action, pad?.id);
      } else if (action === "land") {
        const check = validateEarthLanding(
          {
            position: telemetry.position,
            velocity: telemetry.velocity,
            padId: pad?.id,
          },
          getPhysicsTime(),
        );
        if (!check.ok) throw Error(check.error);
        setLocalPad(pad.id);
      } else {
        const pose = takeoffEarthPose(landedAt, getPhysicsTime());
        if (!pose) throw Error("Landing pad unavailable.");
        setLocalPad(null);
        onTakeoff({ ...pose, snap: true });
      }
      if (current === generation.current) onStop();
    } catch (e) {
      if (current === generation.current)
        setError(e.message || "Landing unavailable.");
    } finally {
      if (current === generation.current) {
        inFlight.current = false;
        setPending(false);
      }
    }
  }, [
    landedAt,
    self?.alive,
    shared,
    session,
    pad?.id,
    telemetry.position,
    telemetry.velocity,
    onStop,
    onTakeoff,
    getPhysicsTime,
    enabled,
  ]);
  const actionRef = useRef(act),
    activeRef = useRef(status.active);
  actionRef.current = act;
  activeRef.current = enabled && (status.active || Boolean(landedAt));
  useEffect(() => {
    const key = (e) => {
      if (
        e.code !== "KeyE" ||
        e.repeat ||
        e.ctrlKey ||
        e.altKey ||
        e.metaKey ||
        isInteractiveTarget(e.target) ||
        !activeRef.current
      )
        return;
      e.preventDefault();
      void actionRef.current();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return { ...status, landedAt, pad, pending, error, act };
}
