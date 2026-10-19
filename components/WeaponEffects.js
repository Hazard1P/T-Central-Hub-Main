'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useUniverseFrame } from '@/components/UniverseFrame';
import { pulsePosition, segmentSphereHit } from '@/lib/shipWeapons';

export default function WeaponEffects({ bus, remote = [], selfId, reducedMotion = false }) {
  const { origin } = useUniverseFrame();
  const beams = useRef(null), sparks = useRef(null), remoteSamples = useRef(new Map());
  const dummy = useMemo(() => new THREE.Object3D(), []), forward = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  useFrame(() => {
    const now = performance.now(), shots = bus.current.shots.filter((shot) => shot.expiresAt > now && !shot.hit);
    for (const shot of shots) {
      const position = pulsePosition(shot, now), previous = shot.previous || shot.origin;
      let impact = null, closest = Infinity;
      for (const rock of bus.current.colliders || []) {
        const hit = segmentSphereHit(previous, position, rock.position, rock.radius);
        if (!hit) continue;
        const distance = Math.hypot(...hit.map((value, axis) => value - previous[axis]));
        if (distance < closest) { closest = distance; impact = hit; }
      }
      if (impact) { shot.hit = true; bus.current.impacts.push({ position: impact, createdAt: now }); }
      shot.previous = position;
    }
    bus.current.shots = shots.filter((shot) => !shot.hit);
    bus.current.impacts = bus.current.impacts.filter((impact) => now - impact.createdAt < 650).slice(-24);
    const visible = bus.current.shots.map((shot) => ({ position: pulsePosition(shot, now), direction: shot.direction }));
    const nextSamples = new Map();
    remote.filter((shot) => shot.ownerId !== selfId).slice(-48).forEach((shot) => {
      const previous = remoteSamples.current.get(shot.id);
      const sample = previous?.shot === shot ? previous : { shot, receivedAt: now };
      nextSamples.set(shot.id, sample);
      const velocity = shot.velocity || [0, 0, 64];
      const direction = shot.direction || new THREE.Vector3(...velocity).normalize().toArray();
      const elapsed = Math.min(.35, (now - sample.receivedAt) / 1000);
      visible.push({ position: shot.position.map((value, axis) => value + velocity[axis] * elapsed), direction });
    });
    remoteSamples.current = nextSamples;
    visible.slice(-72).forEach((shot, index) => {
      dummy.position.set(...shot.position).sub(origin.current); dummy.quaternion.setFromUnitVectors(forward, new THREE.Vector3(...shot.direction)); dummy.scale.set(.045, .045, 2.2); dummy.updateMatrix(); beams.current?.setMatrixAt(index, dummy.matrix);
    });
    beams.current?.position.copy(origin.current); sparks.current?.position.copy(origin.current);
    if (beams.current) { beams.current.count = Math.min(72, visible.length); beams.current.instanceMatrix.needsUpdate = true; }
    let count = 0;
    bus.current.impacts.forEach((impact) => {
      const age = (now - impact.createdAt) / 650;
      for (let index = 0; index < (reducedMotion ? 4 : 12); index += 1) {
        const phase = index * 2.399963;
        dummy.position.set(impact.position[0] + Math.cos(phase) * age * 2, impact.position[1] + Math.sin(phase) * age * 2, impact.position[2] - age * (index % 3));
        dummy.position.sub(origin.current);
        dummy.scale.setScalar((1 - age) * .11); dummy.updateMatrix(); sparks.current?.setMatrixAt(count++, dummy.matrix);
      }
    });
    if (sparks.current) { sparks.current.count = count; sparks.current.instanceMatrix.needsUpdate = true; }
  });
  return <>
    <instancedMesh ref={beams} args={[null, null, 72]} frustumCulled={false}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color={[.5, 2, 3]} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={sparks} args={[null, null, 288]} frustumCulled={false}><icosahedronGeometry args={[1, 0]} /><meshBasicMaterial color={[2.7, 1.2, .4]} toneMapped={false} /></instancedMesh>
  </>;
}
