"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useUniverseFrame } from "@/components/UniverseFrame";
import { pulsePosition } from "@/lib/shipWeapons";
import { firstSphereContact } from "@/lib/physics/collisions";
import { getFlightSolids } from "@/lib/universeFlight";
import { getEarthSafeZone } from "@/lib/earthSafeZone";
import { SHIP_CONTACT_RADIUS } from "@/lib/physics/mechanics";

export default function WeaponEffects({
  bus,
  remote = [],
  selfId,
  reducedMotion = false,
  getPhysicsTime = Date.now,
}) {
  const { origin } = useUniverseFrame();
  const flashes = useRef(null),
    beams = useRef(null),
    sparks = useRef(null),
    remoteSamples = useRef(new Map());
  const dummy = useMemo(() => new THREE.Object3D(), []),
    forward = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  useFrame(() => {
    const now = performance.now(),
      shots = bus.current.shots.filter(
        (shot) => shot.expiresAt > now && !shot.hit,
      );
    const zone = getEarthSafeZone(getPhysicsTime());
    const solids = [
      ...getFlightSolids(getPhysicsTime()),
      { ...zone, collisionRadius: zone.radius + SHIP_CONTACT_RADIUS },
    ];
    const colliders = [...solids, ...(bus.current.colliders || [])];
    for (const shot of shots) {
      const position = pulsePosition(shot, now),
        previous = shot.previous || shot.origin;
      const impact = firstSphereContact(previous, position, colliders)?.point;
      if (impact) {
        shot.hit = true;
        bus.current.impacts.push({ position: impact, createdAt: now });
      }
      shot.previous = position;
    }
    bus.current.shots = shots.filter((shot) => !shot.hit);
    bus.current.impacts = bus.current.impacts
      .filter((impact) => now - impact.createdAt < 650)
      .slice(-24);
    const muzzleFlashes = bus.current.shots
      .filter((shot) => now - shot.createdAt < 90)
      .map((shot) => shot.origin);
    const visible = bus.current.shots.map((shot) => ({
      position: pulsePosition(shot, now),
      direction: shot.direction,
    }));
    const nextSamples = new Map();
    remote
      .filter((shot) => shot.ownerId !== selfId)
      .slice(-48)
      .forEach((shot) => {
        const previous = remoteSamples.current.get(shot.id);
        const sample =
          previous?.shot === shot ? previous : { shot, receivedAt: now };
        nextSamples.set(shot.id, sample);
        const velocity = shot.velocity || [0, 0, 64];
        const direction =
          shot.direction ||
          new THREE.Vector3(...velocity).normalize().toArray();
        const elapsed = Math.min(0.35, (now - sample.receivedAt) / 1000);
        const predicted = shot.position.map(
          (value, axis) => value + velocity[axis] * elapsed,
        );
        if (!firstSphereContact(shot.position, predicted, solids))
          visible.push({ position: predicted, direction });
        if (
          shot.origin &&
          getPhysicsTime() - shot.createdAt >= 0 &&
          getPhysicsTime() - shot.createdAt < 120
        )
          muzzleFlashes.push(shot.origin);
      });
    remoteSamples.current = nextSamples;
    visible.slice(-72).forEach((shot, index) => {
      dummy.position
        .set(...shot.position)
        .addScaledVector(new THREE.Vector3(...shot.direction), 1.1)
        .sub(origin.current);
      dummy.quaternion.setFromUnitVectors(
        forward,
        new THREE.Vector3(...shot.direction),
      );
      dummy.scale.set(0.045, 0.045, 2.2);
      dummy.updateMatrix();
      beams.current?.setMatrixAt(index, dummy.matrix);
    });
    beams.current?.position.copy(origin.current);
    sparks.current?.position.copy(origin.current);
    flashes.current?.position.copy(origin.current);
    muzzleFlashes.slice(-72).forEach((position, index) => {
      dummy.position.set(...position).sub(origin.current);
      dummy.quaternion.identity();
      dummy.scale.setScalar(0.18);
      dummy.updateMatrix();
      flashes.current?.setMatrixAt(index, dummy.matrix);
    });
    if (flashes.current) {
      flashes.current.count = Math.min(72, muzzleFlashes.length);
      flashes.current.instanceMatrix.needsUpdate = true;
    }
    if (beams.current) {
      beams.current.count = Math.min(72, visible.length);
      beams.current.instanceMatrix.needsUpdate = true;
    }
    let count = 0;
    bus.current.impacts.forEach((impact) => {
      const age = (now - impact.createdAt) / 650;
      for (let index = 0; index < (reducedMotion ? 4 : 12); index += 1) {
        const phase = index * 2.399963;
        dummy.position.set(
          impact.position[0] + Math.cos(phase) * age * 2,
          impact.position[1] + Math.sin(phase) * age * 2,
          impact.position[2] - age * (index % 3),
        );
        dummy.position.sub(origin.current);
        dummy.scale.setScalar((1 - age) * 0.11);
        dummy.updateMatrix();
        sparks.current?.setMatrixAt(count++, dummy.matrix);
      }
    });
    if (sparks.current) {
      sparks.current.count = count;
      sparks.current.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <>
      <instancedMesh
        ref={flashes}
        args={[null, null, 72]}
        frustumCulled={false}
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={[1, 3, 4]} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={beams} args={[null, null, 72]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={[0.5, 2, 3]} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={sparks}
        args={[null, null, 288]}
        frustumCulled={false}
      >
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={[2.7, 1.2, 0.4]} toneMapped={false} />
      </instancedMesh>
    </>
  );
}
