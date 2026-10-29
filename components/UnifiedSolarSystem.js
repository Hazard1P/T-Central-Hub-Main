'use client';
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { getSolarSystemState, geostationaryState, SOLAR_BODIES, AU_KM } from '@/lib/solarSystem';
import { SOLAR_UNITS_PER_AU, SOLAR_WORLD_CENTER } from '@/lib/universeSpace';
import { SolarBody } from '@/components/SolarSystemScene';
import { useUniverseFrame } from '@/components/UniverseFrame';
import { getEarthSurfaceState } from '@/lib/earthSurface';

function GeoBeacon({ stateRef, clock, enabled=true }) {
  const marker = useRef(null), ring = useRef(null), label = useRef(null);
  const { origin } = useUniverseFrame();
  const radius = geostationaryState(clock.getTime()).radiusKm / AU_KM * SOLAR_UNITS_PER_AU;
  const points = useMemo(() => Array.from({ length:129 }, (_,i)=>[Math.cos(i*Math.PI/64)*radius,0,Math.sin(i*Math.PI/64)*radius]), [radius]);
  useFrame(({ camera }) => {
    if(ring.current)ring.current.visible=enabled;if(marker.current)marker.current.visible=enabled;
    if(!enabled){if(label.current)label.current.style.display='none';return;}
    const geo=geostationaryState(clock.getTime());
    const position=geo.position.map((v,i)=>SOLAR_WORLD_CENTER[i]+v*SOLAR_UNITS_PER_AU);
    marker.current?.position.set(...position);
    const earth=getEarthSurfaceState(clock.getTime());
    if(ring.current&&earth){
      ring.current.position.set(...earth.position);
      ring.current.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...earth.orientation.y));
    }
    if(label.current) label.current.style.display=new THREE.Vector3(...position).sub(origin.current).distanceTo(camera.position)<3000?'block':'none';
  });
  return <><group ref={ring}><Line points={points} color="#74c7af" opacity={.16} transparent lineWidth={.7} /></group><group ref={marker}><mesh><octahedronGeometry args={[3.5,0]} /><meshBasicMaterial color="#a8ead5" /></mesh><Html center zIndexRange={[20,0]}><span ref={label} className="solar-flight-geo-tag">GEO</span></Html></group></>;
}
export default function UnifiedSolarSystem({ clock, profile, onSelect, walking=false }) {
  const [initial]=useState(()=>getSolarSystemState(clock.getTime()));
  const stateRef=useRef(initial);
  return <>
    {SOLAR_BODIES.map(body=><SolarBody key={body.id} body={body} stateRef={stateRef} getPhysicsTime={clock.getTime} surfaceWalking={walking} segments={Math.max(64, profile.segments)} onSelect={onSelect} />)}
    <GeoBeacon stateRef={stateRef} clock={clock} enabled={!walking} />
  </>;
}
