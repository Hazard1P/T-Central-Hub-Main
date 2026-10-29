"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { earthNatureCell, earthNatureTile } from "@/lib/earthNature";
import {
  getEarthSurfaceState,
  earthSurfaceHeight,
  basisOrientation,
  earthWorldVector,
} from "@/lib/earthSurface";
import { METRES_PER_UNIT } from "@/lib/earthWalk";
import { localTerrainFrame } from "@/lib/earthLocalTerrain";
export default function EarthNature({ anchor, getPhysicsTime }) {
  const root = useRef(),
    rocks = useRef(),
    trunks = useRef(),
    canopies = useRef(),
    radius = getEarthSurfaceState(getPhysicsTime()).radius;
  const cell = earthNatureCell(anchor, radius),
    key = cell.row + ":" + cell.column;
  const tile = useMemo(() => earthNatureTile(anchor, radius), [key, radius]);
  const frame = useMemo(() => {
    const f = localTerrainFrame(tile.anchor, radius);
    return { ...f, forward: f.north.map((v) => -v) };
  }, [tile, radius]);
  const rockProps = tile.props.filter((p) => p.kind === "rock"),
    plants = tile.props.filter((p) => p.kind === "plant");
  const basis = useMemo(
    () =>
      new THREE.Quaternion(
        ...basisOrientation(frame.right, frame.unit, frame.forward),
      ),
    [frame],
  );
  useEffect(() => {
    const object = new THREE.Object3D(),
      dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
      m = 1 / METRES_PER_UNIT;
    const place = (p, lift = 0) => {
      const position = p.direction.map(
        (v, i) =>
          v * (radius + earthSurfaceHeight(p.direction)) - frame.center[i],
      );
      object.position.set(
        dot(position, frame.right),
        dot(position, frame.unit) + lift * m,
        dot(position, frame.forward),
      );
      object.rotation.set(0, p.rotation, 0);
    };
    rockProps.forEach((p, i) => {
      place(p, p.height * 0.45);
      object.scale.set(p.radius * m, p.height * 0.5 * m, p.radius * 0.75 * m);
      object.updateMatrix();
      rocks.current.setMatrixAt(i, object.matrix);
    });
    plants.forEach((p, i) => {
      place(p, p.height * 0.32);
      object.scale.set(0.13 * m, p.height * 0.64 * m, 0.13 * m);
      object.updateMatrix();
      trunks.current.setMatrixAt(i, object.matrix);
      place(p, p.height * 0.7);
      object.scale.set(
        p.height * 0.27 * m,
        p.height * 0.4 * m,
        p.height * 0.27 * m,
      );
      object.updateMatrix();
      canopies.current.setMatrixAt(i, object.matrix);
    });
    for (const ref of [rocks, trunks, canopies])
      if (ref.current) {
        ref.current.instanceMatrix.needsUpdate = true;
        ref.current.computeBoundingSphere();
      }
  }, [tile, frame, radius]);
  useFrame(() => {
    if (!root.current) return;
    const earth = getEarthSurfaceState(getPhysicsTime()),
      matrix = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(...earth.orientation.x),
        new THREE.Vector3(...earth.orientation.y),
        new THREE.Vector3(...earth.orientation.z),
      );
    root.current.quaternion.setFromRotationMatrix(matrix).multiply(basis);
    root.current.position.set(
      ...earthWorldVector(frame.center, earth.orientation).map(
        (v, i) => v + earth.position[i],
      ),
    );
  });
  if (!tile.props.length) return null;
  return (
    <group ref={root}>
      <instancedMesh
        ref={rocks}
        args={[null, null, rockProps.length]}
        raycast={() => null}
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#777769" roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={trunks}
        args={[null, null, plants.length]}
        raycast={() => null}
      >
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshStandardMaterial color="#574638" roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={canopies}
        args={[null, null, plants.length]}
        raycast={() => null}
      >
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#42613a" roughness={1} />
      </instancedMesh>
    </group>
  );
}
