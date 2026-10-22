"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MAX_MULTIPLAYER_PLAYERS } from "@/lib/multiplayerCapacity";
export default function FleetMarkers({ pilots, anchor }) {
  const mesh = useRef(null),
    dummy = useMemo(() => new THREE.Object3D(), []);
  const forward = useMemo(() => new THREE.Vector3(0, 1, 0), []),
    aim = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    pilots.forEach((pilot, index) => {
      dummy.position.set(...pilot.position.map((v, i) => v - anchor[i]));
      aim.set(...(pilot.direction || [0, 0, 1])).normalize();
      dummy.quaternion.setFromUnitVectors(forward, aim);
      dummy.scale.setScalar(2);
      dummy.updateMatrix();
      mesh.current?.setMatrixAt(index, dummy.matrix);
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      position={anchor}
      count={pilots.length}
      args={[undefined, undefined, MAX_MULTIPLAYER_PLAYERS]}
      frustumCulled={false}
    >
      <coneGeometry args={[0.7, 2, 4]} />
      <meshBasicMaterial color="#94e2db" />
    </instancedMesh>
  );
}
