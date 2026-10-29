"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { InterceptorHull } from "@/components/SimulationVisuals";
import {
  earthAnchoredPose,
  PARKED_SHIP_HEIGHT,
  PARKED_SHIP_SCALE,
  METRES_PER_UNIT,
} from "@/lib/earthWalk";
import { basisOrientation } from "@/lib/earthSurface";
import { useUniverseFrame } from "@/components/UniverseFrame";
const m = 1 / METRES_PER_UNIT;
export function ParkedEarthShip({ ship, getPhysicsTime, own = false }) {
  const ref = useRef(),
    label = useRef(),
    { origin } = useUniverseFrame();
  useFrame(({ camera }) => {
    if (!ref.current) return;
    const pose = earthAnchoredPose(
      ship.anchor,
      PARKED_SHIP_HEIGHT,
      getPhysicsTime(),
    );
    ref.current.position.set(...pose.position);
    ref.current.quaternion.set(...pose.orientation);
    if (label.current)
      label.current.style.display =
        own &&
        new THREE.Vector3(...pose.position)
          .sub(origin.current)
          .distanceTo(camera.position) <
          120 * m
          ? "block"
          : "none";
  });
  return (
    <group ref={ref}>
      <group scale={PARKED_SHIP_SCALE}>
        <InterceptorHull />
      </group>
      {own ? (
        <Html
          center
          position={[0, 6 * m, 0]}
          zIndexRange={[30, 0]}
          style={{ pointerEvents: "none" }}
        >
          <span ref={label} className="surface-ship-marker">
            Your ship
          </span>
        </Html>
      ) : null}
    </group>
  );
}
export function WalkingExplorer({ pilot, getPhysicsTime }) {
  const root = useRef(),
    left = useRef(),
    right = useRef();
  useFrame(({ clock }) => {
    if (!root.current || !pilot.walkAnchor) return;
    const pose = earthAnchoredPose(pilot.walkAnchor, 0, getPhysicsTime());
    root.current.position.set(...pose.position);
    const forward = new THREE.Vector3(...(pilot.direction || pose.north))
      .projectOnPlane(new THREE.Vector3(...pose.up))
      .normalize();
    if (forward.lengthSq() < 0.001) forward.set(...pose.north);
    const side = new THREE.Vector3(...pose.up).cross(forward).normalize();
    root.current.quaternion.set(
      ...basisOrientation(side.toArray(), pose.up, forward.toArray()),
    );
    const stride =
      pilot.walkSpeed > 0 ? Math.sin(clock.elapsedTime * 8) * 0.4 : 0;
    if (left.current) left.current.rotation.x = stride;
    if (right.current) right.current.rotation.x = -stride;
  });
  return (
    <group ref={root} scale={m}>
      <mesh position={[0, 1.12, 0]}>
        <capsuleGeometry args={[0.23, 0.48, 4, 8]} />
        <meshStandardMaterial color="#c9d9dd" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.64, 0]}>
        <sphereGeometry args={[0.2, 12, 8]} />
        <meshStandardMaterial color="#e2edf0" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.65, 0.155]}>
        <sphereGeometry args={[0.145, 12, 8]} />
        <meshStandardMaterial color="#17384a" metalness={0.6} roughness={0.2} />
      </mesh>
      {[-1, 1].map((side, i) => (
        <group
          key={side}
          ref={i ? right : left}
          position={[side * 0.12, 0.7, 0]}
        >
          <mesh position={[0, -0.32, 0]}>
            <capsuleGeometry args={[0.095, 0.45, 3, 6]} />
            <meshStandardMaterial color="#8ca3a6" />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.32, 1.12, 0]}>
          <capsuleGeometry args={[0.075, 0.38, 3, 6]} />
          <meshStandardMaterial color="#b4c8cd" />
        </mesh>
      ))}
    </group>
  );
}
