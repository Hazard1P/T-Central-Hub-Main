"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import useShipControls from "@/components/useShipControls";
import { useUniverseFrame } from "@/components/UniverseFrame";
import {
  stepEarthWalk,
  earthAnchoredPose,
  WALK_EYE_HEIGHT,
  METRES_PER_UNIT,
} from "@/lib/earthWalk";
import {
  getEarthSurfaceState,
  earthLocalVector,
  earthWorldVector,
  constrainEarthSurfaceFlight,
} from "@/lib/earthSurface";
import { flightTimeline } from "@/lib/universeSpace";
import { SIM_RUNTIME_STATUS } from "@/lib/simRuntime/contracts";

export default function EarthWalkingRig({
  flightConfig,
  resetTick = 0,
  touchInput,
  onTelemetryChange,
  onSimulationFrame,
  onManualControl,
  correctionState,
  getPhysicsTime,
  simulationSeed,
}) {
  const { camera, gl } = useThree(),
    { origin, rebase } = useUniverseFrame();
  const yaw = useRef(0),
    pitch = useRef(0.02),
    keys = useRef({}),
    anchor = useRef(flightConfig.walkAnchor),
    frame = useRef(flightConfig.frameIndex || 0);
  const enteredAt = useRef(null);
  const transition = useRef(0),
    start = useRef(null);
  useShipControls({
    gl,
    yaw,
    pitch,
    keys,
    blocked: flightConfig.inputBlocked,
    onManualControl,
    onSimulationFrame,
  });
  useEffect(() => {
    yaw.current = 0;
    pitch.current = 0.02;
    keys.current = {};
  }, [resetTick]);
  useEffect(() => {
    if (correctionState?.walkAnchor) {
      anchor.current = correctionState.walkAnchor;
      frame.current = Math.max(frame.current, correctionState.frameIndex || 0);
    }
  }, [correctionState]);
  useFrame((state, delta) => {
    if (!anchor.current) return;
    const utcMs = getPhysicsTime(),
      earth = getEarthSurfaceState(utcMs);
    if (enteredAt.current === null) enteredAt.current = performance.now();
    if (!start.current)
      start.current = earthLocalVector(
        camera.position
          .clone()
          .add(origin.current)
          .toArray()
          .map((v, i) => v - earth.position[i]),
        earth.orientation,
      );
    const pose = earthAnchoredPose(anchor.current, WALK_EYE_HEIGHT, utcMs);
    const surfaceQuat = new THREE.Quaternion(...pose.orientation);
    const looking = new THREE.Quaternion()
      .setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, "YXZ"))
      .premultiply(surfaceQuat);
    const x =
      (keys.current.KeyD || keys.current.ArrowRight ? 1 : 0) -
      (keys.current.KeyA || keys.current.ArrowLeft ? 1 : 0) +
      (touchInput.x || 0);
    const z =
      (keys.current.KeyW || keys.current.ArrowUp ? 1 : 0) -
      (keys.current.KeyS || keys.current.ArrowDown ? 1 : 0) +
      (touchInput.z || 0);
    const sprint = Boolean(
      keys.current.ControlLeft || keys.current.ControlRight || touchInput.boost,
    );
    const heading = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw.current)
      .premultiply(surfaceQuat);
    const control = new THREE.Vector3(x, 0, z);
    if (control.length() > 1) control.normalize();
    control.multiplyScalar(sprint ? 1.75 : 1).applyQuaternion(heading);
    if (flightConfig.inputBlocked) control.set(0, 0, 0);
    let walked = pose;
    for (const sample of flightTimeline(delta,utcMs)) {
      const dt=sample.dt;
      walked = stepEarthWalk({
        anchor: anchor.current,
        parkedShip: flightConfig.parkedShip,
        controlVector: control.toArray(),
        dt,
        utcMs:sample.utcMs,
      });
      anchor.current = walked.walkAnchor;
      frame.current++;
      onSimulationFrame?.({
        frameIndex: frame.current,
        controlVector: control.toArray(),
        dt,
        walking: true,
      });
    }
    transition.current = Math.min(
      1,
      (performance.now() - enteredAt.current) / 2400,
    );
    const ease = 1 - (1 - transition.current) ** 4;
    const targetLocal = earthLocalVector(
      walked.position.map((v, i) => v - earth.position[i]),
      earth.orientation,
    );
    const local = targetLocal.map(
      (v, i) => start.current[i] * (1 - ease) + v * ease,
    );
    let target = earthWorldVector(local, earth.orientation).map(
      (v, i) => v + earth.position[i],
    );
    target = constrainEarthSurfaceFlight(
      target,
      [0, 0, 0],
      utcMs,
      target,
      WALK_EYE_HEIGHT,
    ).position;
    rebase(walked.position, camera, true);
    camera.position.set(
      ...target.map((v, i) => v - origin.current.getComponent(i)),
    );
    const forward = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(looking)
      .normalize();
    camera.up.set(...walked.up);
    camera.lookAt(camera.position.clone().add(forward));
    const nextFov = 65;
    if (
      Math.abs(camera.fov - nextFov) > 0.01 ||
      camera.near !== WALK_EYE_HEIGHT / 100
    ) {
      camera.fov = nextFov;
      camera.near = WALK_EYE_HEIGHT / 100;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    onTelemetryChange?.({
      position: walked.position,
      velocity: walked.velocity || [0, 0, 0],
      direction: forward.toArray(),
      orientation: looking.toArray(),
      frameIndex: frame.current,
      tick: Date.now(),
      speed: walked.walkSpeed || 0,
      walkSpeedMps: (walked.walkSpeed || 0) * METRES_PER_UNIT,
      movementMode: "walk",
      walkAnchor: anchor.current,
      travelMode: "On foot",
      safeZone: true,
      surfaceAltitude: WALK_EYE_HEIGHT,
      latitude: walked.latitude,
      longitude: walked.longitude,
      controlVector: control.toArray(),
      simulationSeed,
      runtime: { status: SIM_RUNTIME_STATUS.ONLINE },
      firing: false,
    });
    state.invalidate();
  }, -2);
  return null;
}
