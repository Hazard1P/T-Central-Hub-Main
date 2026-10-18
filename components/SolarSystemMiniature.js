'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import useSolarClock from '@/components/useSolarClock';
import { getSolarSystemState, sampleSolarOrbit, SOLAR_PLANETS, SOLAR_HUB_SCALE } from '@/lib/solarSystem';

export default function SolarSystemMiniature() {
  const clock = useSolarClock();
  const refs = useRef({}), sampled = useRef(0);
  const paths = useMemo(() => SOLAR_PLANETS.map((body) => ({ body, points: sampleSolarOrbit(body, Date.now(), 64).map((point) => point.map((coordinate) => coordinate * SOLAR_HUB_SCALE)) })), []);
  useFrame(({ clock: renderClock }) => {
    if (renderClock.elapsedTime - sampled.current < .5) return;
    sampled.current = renderClock.elapsedTime;
    getSolarSystemState(clock.getTime()).forEach((body) => { refs.current[body.id]?.position.set(...body.position.map((coordinate) => coordinate * SOLAR_HUB_SCALE)); });
  });
  return <group>
    <mesh><sphereGeometry args={[.065, 20, 12]} /><meshBasicMaterial color="#fff2d4" /></mesh>
    {paths.map(({ body, points }) => <group key={body.id}>
      <Line points={points} color={body.color} opacity={.32} transparent lineWidth={.8} />
      <mesh ref={(value) => { refs.current[body.id] = value; }}><sphereGeometry args={[.026, 12, 8]} /><meshBasicMaterial color={body.color} /></mesh>
    </group>)}
  </group>;
}
