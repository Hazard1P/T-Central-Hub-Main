"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  validateEarthWalk,
  earthAnchorDistance,
  earthAnchorAt,
  earthAnchoredPose,
  METRES_PER_UNIT,
  WALK_BOARD_RANGE,
  boardEarthShip,
} from "@/lib/earthWalk";
import { getEarthSurfaceStatus } from "@/lib/earthSurface";
import { isInteractiveTarget } from "@/lib/flightInput";
export default function useEarthJourney({
  self,
  session,
  shared,
  telemetry,
  getPhysicsTime,
  roomName,
  spawnTick,
  enabled,
  onStop,
  onTakeoff,
}) {
  const [solo, setSolo] = useState({
      movementMode: "ship",
      movementSequence: 0,
    }),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const busy = useRef(false),
    generation = useRef(0);
  useEffect(() => {
    generation.current++;
    busy.current = false;
    setPending(false);
    setError("");
    setSolo({ movementMode: "ship", movementSequence: 0 });
    return () => {
      generation.current++;
    };
  }, [shared, roomName, spawnTick]);
  const state = shared ? self : solo,
    walking = state?.movementMode === "walk";
  const status = useMemo(
    () =>
      walking && (telemetry.walkAnchor || state?.walkAnchor)
        ? earthAnchoredPose(
            telemetry.walkAnchor || state.walkAnchor,
            0,
            getPhysicsTime(),
          )
        : getEarthSurfaceStatus(
            telemetry.position,
            telemetry.velocity,
            getPhysicsTime(),
          ),
    [
      telemetry.position,
      telemetry.velocity,
      telemetry.walkAnchor,
      walking,
      state?.walkAnchor,
      getPhysicsTime,
    ],
  );
  const shipDistance =
    walking && state.parkedShip && state.walkAnchor
      ? earthAnchorDistance(
          telemetry.walkAnchor || state.walkAnchor,
          state.parkedShip.anchor,
          getPhysicsTime(),
        )
      : 0;
  const check =
    status.altitude < 10
      ? validateEarthWalk(
          telemetry.position,
          telemetry.velocity,
          getPhysicsTime(),
        )
      : { ok: false, error: "Approach the surface to land." };
  const act = useCallback(async () => {
    if (!enabled || busy.current || self?.alive === false) return;
    const current = generation.current;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      onStop();
      if (shared) {
        if (!session?.requestSurface)
          throw Error("Reconnect before exploring Earth.");
        await session.requestSurface(walking ? "board" : "walk");
      } else if (!walking) {
        const result = validateEarthWalk(
          telemetry.position,
          telemetry.velocity,
          getPhysicsTime(),
        );
        if (!result.ok) throw Error(result.error);
        setSolo({
          movementMode: "walk",
          movementSequence: (solo.movementSequence || 0) + 1,
          walkAnchor: result.walkAnchor,
          parkedShip: result.parkedShip,
        });
      } else {
        const result = boardEarthShip(
          telemetry.walkAnchor || solo.walkAnchor,
          solo.parkedShip,
          getPhysicsTime(),
        );
        if (!result.ok) throw Error(result.error);
        setSolo({
          movementMode: "ship",
          movementSequence: (solo.movementSequence || 0) + 1,
        });
        onTakeoff({ ...result, snap: true });
      }
    } catch (e) {
      if (current === generation.current)
        setError(e.message || "Surface exploration is unavailable.");
    } finally {
      if (current === generation.current) {
        setPending(false);
        busy.current = false;
      }
    }
  }, [
    enabled,
    self?.alive,
    onStop,
    onTakeoff,
    shared,
    session,
    walking,
    telemetry.position,
    telemetry.velocity,
    telemetry.walkAnchor,
    getPhysicsTime,
    solo,
  ]);
  const ref = useRef();
  ref.current = { act, enabled, active: walking || status.altitude < 10 };
  useEffect(() => {
    const key = (e) => {
      if (
        e.code !== "KeyE" ||
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        isInteractiveTarget(e.target) ||
        !ref.current.enabled ||
        !ref.current.active
      )
        return;
      e.preventDefault();
      void ref.current.act();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return {
    state,
    walking,
    pending,
    error,
    act,
    active: walking || status.altitude < 10,
    canAct:
      enabled &&
      !pending &&
      (walking ? shipDistance <= WALK_BOARD_RANGE : check.ok),
    shipDistanceMetres: shipDistance * METRES_PER_UNIT,
    latitude: status.latitude,
    longitude: status.longitude,
    help: walking
      ? "WASD to walk · mouse or drag to look"
      : check.ok
        ? "Ready to land on dry ground"
        : check.error,
  };
}
