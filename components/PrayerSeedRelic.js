'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PRAYER_RELIC_POSITION } from '@/lib/prayerSeedDiscovery';

export default function PrayerSeedRelic({ telemetryRef, animate }) {
  const group = useRef(null);
  const core = useRef(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const position = telemetryRef.current.position;
    const distance = Math.hypot(...position.map((value, index) => value - PRAYER_RELIC_POSITION[index]));
    group.current.visible = distance < 23;
    if (animate && core.current) {
      core.current.rotation.y = clock.elapsedTime * .16;
      core.current.position.y = Math.sin(clock.elapsedTime * .7) * .16;
    }
  });
  return <group ref={group} position={PRAYER_RELIC_POSITION} visible={false}>
    <group ref={core}>
      <mesh><octahedronGeometry args={[.22, 0]} /><meshStandardMaterial color="#fff0c7" emissive="#ffcf80" emissiveIntensity={2} roughness={.2} metalness={.65} /></mesh>
      {[0, 1, 2].map((index) => <mesh key={index} rotation={[Math.PI * index / 3, .6 * index, .4]}>
        <torusGeometry args={[.55 + index * .15, .012, 6, 64]} /><meshBasicMaterial color={index === 1 ? '#b1fff0' : '#f4db9d'} transparent opacity={.65} />
      </mesh>)}
    </group>
  </group>;
}
