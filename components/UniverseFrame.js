'use client';
import { createContext, useContext, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { floatingOrigin } from '@/lib/universeSpace';
const zero = { current: new THREE.Vector3() };
const Frame = createContext({ origin: zero, rebase: () => {} });
export const useUniverseFrame = () => useContext(Frame);
export default function UniverseFrame({ children }) {
  const group = useRef(null), origin = useRef(new THREE.Vector3());
  const value = useMemo(() => ({ origin, rebase(position, camera) {
    const next = new THREE.Vector3(...floatingOrigin(position));
    camera.position.sub(next.clone().sub(origin.current));
    origin.current.copy(next);
    group.current?.position.copy(next).negate();
  } }), []);
  return <Frame.Provider value={value}><group ref={group}>{children}</group></Frame.Provider>;
}
export function UniverseSky({ children }) {
  const group = useRef(null), { origin } = useUniverseFrame();
  useFrame(({ camera }) => group.current?.position.copy(camera.position).add(origin.current));
  return <group ref={group}>{children}</group>;
}
