'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { AU_KM, geostationaryState, getSolarSystemState, SOLAR_BODIES } from '@/lib/solarSystem';
import { SOLAR_FLIGHT_CENTER, SOLAR_FLIGHT_RADIUS } from '@/lib/flightRegions';
import { SolarBody } from '@/components/SolarSystemScene';
import CelestialDebris from '@/components/CelestialDebris';

function GeoBeacon({ stateRef, originRef, frame, clock }) {
  const marker = useRef(null), ring = useRef(null);
  const radius = geostationaryState(clock.getTime()).radiusKm / AU_KM;
  const points = useMemo(() => Array.from({ length: 129 }, (_, index) => [Math.cos(index * Math.PI / 64) * radius, 0, Math.sin(index * Math.PI / 64) * radius]), [radius]);
  useFrame(() => {
    if (!frame.current) return;
    const geo = geostationaryState(clock.getTime());
    const position = new THREE.Vector3(...geo.position.map((value, axis) => value - originRef.current[axis])).applyQuaternion(frame.current.rotation).multiplyScalar(frame.current.unitsPerAu).add(frame.current.center);
    marker.current?.position.copy(position);
    const earth = stateRef.current.find((body) => body.id === 'earth');
    if (ring.current && earth) {
      ring.current.position.copy(frame.current.center); ring.current.scale.setScalar(frame.current.unitsPerAu);
      const axis = new THREE.Vector3(...earth.orientation.y).applyQuaternion(frame.current.rotation);
      ring.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    }
  });
  return <>
    <group ref={ring}><Line points={points} color="#74c7af" opacity={.18} transparent lineWidth={.7} /></group>
    <group ref={marker}><mesh><octahedronGeometry args={[.35, 0]} /><meshBasicMaterial color="#a8ead5" /></mesh><Html center distanceFactor={25} zIndexRange={[20, 0]}><span className="solar-flight-geo-tag">GEO</span></Html></group>
  </>;
}

export default function SolarFlightScene({ bodyId, clock, profile, bus }) {
  const [initial] = useState(() => getSolarSystemState(clock.getTime()));
  const stateRef = useRef(initial), originRef = useRef([0, 0, 0]), frame = useRef(null), last = useRef(-1), sky = useRef(null);
  useFrame(({ camera, clock: renderClock }) => {
    if (renderClock.elapsedTime - last.current > .1 || !frame.current || frame.current.body !== bodyId) {
      last.current = renderClock.elapsedTime; stateRef.current = getSolarSystemState(clock.getTime());
      const body = stateRef.current.find((entry) => entry.id === bodyId);
      originRef.current = body.position;
      const toSun = new THREE.Vector3(...body.position).negate().normalize();
      const rotation = bodyId === 'sun' ? new THREE.Quaternion() : new THREE.Quaternion().setFromUnitVectors(toSun, new THREE.Vector3(0, 0, -1));
      frame.current = { body: bodyId, rotation, unitsPerAu: SOLAR_FLIGHT_RADIUS / body.radiusAu, center: new THREE.Vector3(...SOLAR_FLIGHT_CENTER) };
    }
    sky.current?.position.copy(camera.position);
    if (camera.far !== 1800) { camera.far = 1800; camera.near = .03; camera.updateProjectionMatrix(); }
  }, -2);
  return <>
    <color attach="background" args={['#02050a']} />
    <group ref={sky}><Stars radius={350} depth={200} count={profile.stars} factor={5} fade speed={0} /></group>
    {SOLAR_BODIES.map((body) => <SolarBody key={body.id} body={body} stateRef={stateRef} originRef={originRef} flightFrame={frame} enhanced={false} segments={profile.segments} />)}
    {bodyId === 'earth' ? <GeoBeacon stateRef={stateRef} originRef={originRef} frame={frame} clock={clock} /> : null}
    <CelestialDebris profile={profile} bus={bus} localOrbit lightDirection={[0, 0, -1]} />
    <hemisphereLight args={['#b6d2e8', '#111a26', .9]} /><directionalLight position={[0, 10, -80]} intensity={2.5} color="#fff3dd" />
  </>;
}
