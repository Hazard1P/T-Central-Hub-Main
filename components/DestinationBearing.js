'use client';

import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useUniverseFrame } from '@/components/UniverseFrame';

// A single edge-clamped bearing replaces labels over every object in the scene.
export default function DestinationBearing({ destination }) {
  const marker = useRef(null), anchor = useRef(null);
  const { origin } = useUniverseFrame();
  const projection = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const forward = useRef(new THREE.Vector3());
  useFrame(({ camera, size }) => {
    if (!marker.current || !destination?.position) return;
    projection.current.set(...destination.position).sub(origin.current).project(camera);
    camera.getWorldDirection(forward.current);
    anchor.current?.position.copy(camera.position).add(origin.current).addScaledVector(forward.current, 10);
    direction.current.set(...destination.position).sub(origin.current).sub(camera.position);
    const behind = direction.current.dot(forward.current) < 0;
    let x = projection.current.x;
    let y = -projection.current.y;
    if (behind) { x *= -1; y *= -1; if (Math.abs(x) + Math.abs(y) < .01) x = 1; }
    const offscreen = behind || Math.abs(x) > .86 || Math.abs(y) > .75;
    if (offscreen) {
      const edge = Math.max(Math.abs(x) / .86, Math.abs(y) / .75, .001);
      x /= edge; y /= edge;
    }
    marker.current.style.left = ((x + 1) * size.width / 2) + 'px';
    marker.current.style.top = ((y + 1) * size.height / 2) + 'px';
    marker.current.style.setProperty('--bearing-angle', Math.atan2(y, x) + 'rad');
    marker.current.dataset.offscreen = String(offscreen);
  });
  if (!destination) return null;
  return <group ref={anchor}><Html fullscreen calculatePosition={(_, __, size) => [size.width / 2, size.height / 2]} style={{ pointerEvents: 'none' }} zIndexRange={[35, 0]}>
    <div className="exploration-bearing" ref={marker} aria-hidden="true">
      <span className="exploration-bearing-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m8 5 8 7-8 7" /></svg></span>
      <span>{destination.label}</span>
    </div>
  </Html></group>;
}
