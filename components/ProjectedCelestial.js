'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useUniverseFrame } from '@/components/UniverseFrame';

// Preserve angular size across the continuous universe without pushing distant
// geometry beyond the depth buffer. Physical navigation uses true coordinates.
export default function ProjectedCelestial({ position, scale = 1, children, ...props }) {
  const group = useRef(null), { origin } = useUniverseFrame();
  const offset = useRef(new THREE.Vector3()), cameraWorld = useRef(new THREE.Vector3());
  useFrame(({ camera }) => {
    if (!group.current) return;
    cameraWorld.current.copy(camera.position).add(origin.current);
    offset.current.set(...position).sub(cameraWorld.current);
    const distance = offset.current.length();
    const projected = distance > 20000 ? 20000 + Math.min(40000, Math.log2(distance / 20000) * 1000) : distance;
    const ratio = distance > 0 ? projected / distance : 1;
    group.current.position.copy(cameraWorld.current).add(offset.current.multiplyScalar(ratio));
    group.current.scale.setScalar(scale * ratio);
  });
  return <group ref={group} position={position} scale={scale} {...props}>{children}</group>;
}
