"use client";
import { useMemo, useRef } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { getEarthSafeZone } from "@/lib/earthSafeZone";
import { useUniverseFrame } from "@/components/UniverseFrame";

export default function EarthSafeZone({ getPhysicsTime = Date.now }) {
  const boundary = useRef(null);
  const { origin } = useUniverseFrame();
  const arcs = useMemo(
    () =>
      [0, 1, 2].map((axis) =>
        Array.from({ length: 129 }, (_, index) => {
          const angle = (index * Math.PI) / 64,
            a = Math.cos(angle),
            b = Math.sin(angle);
          return axis === 0 ? [a, b, 0] : axis === 1 ? [a, 0, b] : [0, a, b];
        }),
      ),
    [],
  );
  useFrame(({ camera }) => {
    if (!boundary.current) return;
    const zone = getEarthSafeZone(getPhysicsTime());
    boundary.current.position.set(...zone.position);
    boundary.current.scale.setScalar(zone.radius);
    const distance = Math.hypot(
      ...zone.position.map(
        (v, i) =>
          v - origin.current.getComponent(i) - camera.position.getComponent(i),
      ),
    );
    boundary.current.visible = distance < zone.radius * 3;
  });
  return (
    <group ref={boundary}>
      {arcs.map((points, index) => (
        <Line
          key={index}
          points={points}
          color="#75e8bd"
          transparent
          opacity={0.18}
          lineWidth={0.7}
          depthWrite={false}
          raycast={() => null}
        />
      ))}
    </group>
  );
}
