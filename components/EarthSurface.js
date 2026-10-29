"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getEarthSurfaceStatus } from "@/lib/earthSurface";
import { useUniverseFrame } from "@/components/UniverseFrame";

// Terrain lives on the globe itself (SolarSystemScene), never in separate
// landing-site patches. This atmosphere follows the camera throughout Earth.
export default function EarthSurface({ getPhysicsTime }) {
  const sky = useRef(null),
    { origin } = useUniverseFrame();
  useFrame(({ camera }) => {
    if (!sky.current) return;
    const world = camera.position.clone().add(origin.current);
    const { altitude } = getEarthSurfaceStatus(
      world.toArray(),
      [0, 0, 0],
      getPhysicsTime(),
    );
    sky.current.position.copy(world);
    sky.current.visible = altitude < 100;
    sky.current.material.opacity = Math.max(
      0,
      Math.min(0.38, (100 - altitude) / 220),
    );
  });
  return (
    <mesh ref={sky} renderOrder={-50} raycast={() => null}>
      <sphereGeometry args={[600, 24, 16]} />
      <meshBasicMaterial
        color="#5c94b5"
        side={THREE.BackSide}
        transparent
        opacity={0}
        depthWrite={false}
      />
    </mesh>
  );
}
