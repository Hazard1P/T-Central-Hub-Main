"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import {
  EARTH_PORTS,
  earthTerrainHeight,
  getEarthLandingSites,
  getEarthLandingDestinations,
  landingEarthState,
} from "@/lib/earthLanding";
import { useUniverseFrame } from "@/components/UniverseFrame";

function LandingPad({ pad, color, occupied }) {
  return (
    <group position={pad.offset}>
      <mesh position={[0, -2.75, 0]}>
        <cylinderGeometry args={[6.6, 7.4, 5.5, 8]} />
        <meshStandardMaterial color="#24343e" roughness={0.85} />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[6.4, 6.4, 0.18, 32]} />
        <meshStandardMaterial
          color="#384c56"
          metalness={0.45}
          roughness={0.65}
        />
      </mesh>
      <mesh position={[0, 0.11, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[5.6, 0.085, 6, 48]} />
        <meshBasicMaterial
          color={occupied ? "#f4bc78" : color}
          toneMapped={false}
        />
      </mesh>
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x * 1.2, 0.1, 0]}>
          <boxGeometry args={[0.4, 0.04, 3]} />
          <meshBasicMaterial color="#e2eddf" />
        </mesh>
      ))}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[2.4, 0.04, 0.4]} />
        <meshBasicMaterial color="#e2eddf" />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i * Math.PI) / 4;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 6, 0.18, Math.sin(angle) * 6]}
          >
            <sphereGeometry args={[0.13, 8, 6]} />
            <meshBasicMaterial
              color={occupied ? "#f4bc78" : color}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
function PortTerrain({ radius }) {
  const geometry = useMemo(() => {
    const mesh = new THREE.PlaneGeometry(112, 112, 56, 56);
    mesh.rotateX(-Math.PI / 2);
    const positions = mesh.attributes.position,
      colors = new Float32Array(positions.count * 3),
      color = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        z = positions.getZ(i);
      positions.setY(i, earthTerrainHeight(x, z, radius));
      const detail = Math.sin(x * 1.8 + Math.cos(z * 0.8)) * 0.035;
      const concrete = Math.abs(x) < 23 && Math.abs(z) < 23;
      color.set(
        concrete ? "#546061" : Math.hypot(x, z) > 46 ? "#445544" : "#63785a",
      );
      color.offsetHSL(0, 0, detail);
      colors.set([color.r, color.g, color.b], i * 3);
    }
    mesh.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    mesh.computeVertexNormals();
    return mesh;
  }, [radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={0.98} />
    </mesh>
  );
}
function SurfacePort({ id, getPhysicsTime, onSelect, players }) {
  const group = useRef(null),
    detail = useRef(null),
    beacon = useRef(null),
    label = useRef(null);
  const { origin } = useUniverseFrame();
  const initial = useMemo(
    () => getEarthLandingSites(getPhysicsTime()).find((s) => s.id === id),
    [id, getPhysicsTime],
  );
  useFrame(({ camera }) => {
    const site = getEarthLandingSites(getPhysicsTime()).find(
      (s) => s.id === id,
    );
    if (!group.current) return;
    group.current.position.set(...site.position);
    group.current.quaternion.set(...site.orientation);
    const range = Math.hypot(
      ...site.position.map(
        (v, i) =>
          v - origin.current.getComponent(i) - camera.position.getComponent(i),
      ),
    );
    if (detail.current) detail.current.visible = range < 180;
    if (beacon.current) beacon.current.visible = range < 1500;
    const aboveHorizon =
      site.up.reduce(
        (sum, v, i) =>
          sum +
          v *
            (camera.position.getComponent(i) +
              origin.current.getComponent(i) -
              site.position[i]),
        0,
      ) > -5;
    if (label.current)
      label.current.style.display =
        range < 1500 && aboveHorizon ? "block" : "none";
  });
  const occupied = (players || []).map((p) => p.landedAt).filter(Boolean);
  return (
    <group ref={group}>
      <group ref={detail}>
        <PortTerrain radius={initial.radius} />
        {initial.pads.map((pad) => (
          <LandingPad
            key={pad.id}
            pad={pad}
            color={initial.color}
            occupied={occupied.includes(pad.id)}
          />
        ))}
        <group position={[-29, 2.5, 0]}>
          <mesh>
            <boxGeometry args={[8, 5, 10]} />
            <meshStandardMaterial
              color="#7e979d"
              metalness={0.5}
              roughness={0.65}
            />
          </mesh>
          <mesh position={[0, 1, -5.03]}>
            <boxGeometry args={[6.5, 2.3, 0.12]} />
            <meshStandardMaterial
              color="#183345"
              emissive="#376c7a"
              emissiveIntensity={0.6}
            />
          </mesh>
          <mesh position={[0, -0.5, 5.03]}>
            <boxGeometry args={[6.6, 3.4, 0.15]} />
            <meshStandardMaterial color="#283d49" metalness={0.65} />
          </mesh>
          {[-2, 0, 2].map((x) => (
            <mesh key={x} position={[x, 2.6, 0]}>
              <boxGeometry args={[0.1, 0.12, 9]} />
              <meshBasicMaterial color={initial.color} />
            </mesh>
          ))}
        </group>
        <group position={[0, 0, 30]}>
          <mesh position={[0, 5, 0]}>
            <cylinderGeometry args={[1.2, 2.5, 10, 8]} />
            <meshStandardMaterial color="#b3bec2" metalness={0.45} />
          </mesh>
          <mesh position={[0, 10, 0]}>
            <cylinderGeometry args={[4, 3.2, 2.5, 8]} />
            <meshStandardMaterial
              color="#285067"
              emissive="#17394c"
              emissiveIntensity={0.5}
              metalness={0.5}
            />
          </mesh>
          <mesh position={[0, 13, 0]}>
            <cylinderGeometry args={[0.08, 0.15, 3.5, 6]} />
            <meshStandardMaterial color="#c9dbde" />
          </mesh>
          <mesh position={[0, 15, 0]}>
            <sphereGeometry args={[0.23, 8, 6]} />
            <meshBasicMaterial color="#ffb696" toneMapped={false} />
          </mesh>
        </group>
        <group position={[27, 1.5, 0]}>
          <mesh>
            <boxGeometry args={[6, 3, 7]} />
            <meshStandardMaterial
              color="#667e8a"
              metalness={0.6}
              roughness={0.55}
            />
          </mesh>
          {[-1, 1].map((z) => (
            <mesh key={z} position={[0, 2, z * 2]} rotation={[0.18, 0, 0]}>
              <boxGeometry args={[6, 0.12, 2.8]} />
              <meshStandardMaterial
                color="#163554"
                metalness={0.8}
                roughness={0.3}
              />
            </mesh>
          ))}
        </group>
        {Array.from({ length: 18 }, (_, i) => {
          const a = i * 2.399963,
            r = 33 + (i % 4) * 4,
            x = Math.cos(a) * r,
            z = Math.sin(a) * r;
          return (
            <mesh
              key={i}
              position={[x, earthTerrainHeight(x, z, initial.radius) + 0.5, z]}
              scale={[1.4 + (i % 3) * 0.3, 0.7, 1]}
              rotation={[i * 0.3, i, 0]}
            >
              <icosahedronGeometry args={[1, 0]} />
              <meshStandardMaterial
                color={i % 2 ? "#829181" : "#56655e"}
                roughness={1}
              />
            </mesh>
          );
        })}
        {[-1, 1].map((side) => (
          <group key={side}>
            {Array.from({ length: 8 }, (_, i) => (
              <mesh key={i} position={[side * 3, 0.25, -23 - i * 2.2]}>
                <boxGeometry args={[0.28, 0.13, 0.6]} />
                <meshBasicMaterial color={initial.color} toneMapped={false} />
              </mesh>
            ))}
          </group>
        ))}
        <hemisphereLight
          args={["#b9e0ef", "#536345", 0.9]}
          position={[0, 50, 0]}
        />
      </group>
      <group ref={beacon} position={[0, 22, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.8, 0.14, 6, 32]} />
          <meshBasicMaterial color={initial.color} />
        </mesh>
        <Html center position={[0, 6, 0]} zIndexRange={[25, 0]}>
          <button
            ref={label}
            className="earth-port-label"
            onClick={() =>
              onSelect(
                getEarthLandingDestinations(getPhysicsTime()).find(
                  (p) => p.key === "earth-port-" + id,
                ),
              )
            }
          >
            {initial.name}
            <small>Earth landing zone</small>
          </button>
        </Html>
      </group>
    </group>
  );
}
export default function EarthSurface({ getPhysicsTime, onSelect, players }) {
  const sky = useRef(null),
    { origin } = useUniverseFrame();
  useFrame(({ camera }) => {
    if (!sky.current) return;
    const earth = landingEarthState(getPhysicsTime()),
      world = camera.position.clone().add(origin.current);
    const altitude =
      world.distanceTo(new THREE.Vector3(...earth.position)) - earth.radius;
    sky.current.position.copy(world);
    sky.current.visible = altitude < 100;
    sky.current.material.opacity = Math.max(
      0,
      Math.min(0.48, (100 - altitude) / 180),
    );
  });
  return (
    <>
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
      {EARTH_PORTS.map((port) => (
        <SurfacePort
          key={port.id}
          id={port.id}
          getPhysicsTime={getPhysicsTime}
          onSelect={onSelect}
          players={players}
        />
      ))}
    </>
  );
}
