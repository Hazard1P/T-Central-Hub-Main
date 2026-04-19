'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Line, Sparkles, Stars, Trail } from '@react-three/drei';
import * as THREE from 'three';
import { buildUniverseGraph, getNodePositionMap } from '@/lib/universeEngine';

function useDeviceTier() {
  const [tier, setTier] = useState({ isMobile: false, dpr: [1, 1.35], stars: 4200, sparkles: 110, meteors: 6, labels: 3 });

  useEffect(() => {
    const update = () => {
      const isMobile = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;
      setTier({
        isMobile,
        dpr: isMobile ? [1, 1.15] : [1, 1.35],
        stars: isMobile ? 2400 : 4200,
        sparkles: isMobile ? 60 : 110,
        meteors: isMobile ? 4 : 6,
        labels: isMobile ? 2 : 4,
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return tier;
}

function CinematicDustField({ sparkleCount }) {
  const group = useRef(null);
  const clouds = [
    { position: [-16, 8, -26], scale: [18, 10, 1], color: '#7f6dff', opacity: 0.16 },
    { position: [18, -6, -22], scale: [16, 9, 1], color: '#5fdcff', opacity: 0.12 },
    { position: [4, 14, -30], scale: [24, 11, 1], color: '#ffbf66', opacity: 0.08 },
  ];

  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.01;
      group.current.rotation.z += delta * 0.004;
    }
  });

  return (
    <group ref={group}>
      {clouds.map((cloud) => (
        <mesh key={cloud.position.join(':')} position={cloud.position} scale={cloud.scale}>
          <planeGeometry args={[1, 1, 16, 16]} />
          <meshBasicMaterial color={cloud.color} transparent opacity={cloud.opacity} depthWrite={false} />
        </mesh>
      ))}
      <Sparkles count={sparkleCount} scale={[52, 32, 38]} size={2.8} speed={0.18} opacity={0.75} />
    </group>
  );
}

function RouteRibbon({ from, to, color = '#7fe7ff', arc = 1.8, faint = false }) {
  const points = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = start.clone().lerp(end, 0.5);
    mid.y += arc;
    return [start, mid, end];
  }, [from, to, arc]);

  return (
    <Line points={points} color={color} lineWidth={faint ? 0.7 : 1.35} transparent opacity={faint ? 0.22 : 0.48} />
  );
}

function EventHorizon({ radius = 1.8, color = '#9fdcff' }) {
  const ringA = useRef(null);
  const ringB = useRef(null);
  const glow = useRef(null);

  useFrame(({ clock }, delta) => {
    if (ringA.current) ringA.current.rotation.z += delta * 0.72;
    if (ringB.current) ringB.current.rotation.x -= delta * 0.46;
    if (glow.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 1.9) * 0.08;
      glow.current.scale.setScalar(pulse);
    }
  });

  return (
    <group>
      <mesh ref={glow}>
        <sphereGeometry args={[radius * 1.9, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <mesh ref={ringA} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, radius * 0.28, 28, 140]} />
        <meshBasicMaterial color={color} transparent opacity={0.82} depthWrite={false} />
      </mesh>
      <mesh ref={ringB} rotation={[Math.PI / 2.4, Math.PI / 6, 0]}>
        <torusGeometry args={[radius * 1.32, radius * 0.08, 16, 120]} />
        <meshBasicMaterial color="#d7f7ff" transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </group>
  );
}

function MeteorField({ count = 6, spread = 32 }) {
  const refs = useRef([]);
  const meteors = useMemo(
    () => Array.from({ length: count }, (_, index) => ({
      key: `landing-meteor-${index}`,
      orbitRadius: 10 + (index % 4) * 5 + spread * 0.1,
      speed: 0.15 + (index % 5) * 0.03,
      angle: (Math.PI * 2 * index) / count,
      height: ((index % 4) - 2) * 1.5,
      size: 0.1 + (index % 3) * 0.05,
    })),
    [count, spread]
  );

  useFrame(({ clock }) => {
    meteors.forEach((meteor, index) => {
      const ref = refs.current[index];
      if (!ref) return;
      const angle = clock.elapsedTime * meteor.speed + meteor.angle;
      ref.position.set(
        Math.cos(angle) * meteor.orbitRadius,
        meteor.height + Math.sin(angle * 2.2) * 0.6,
        Math.sin(angle) * meteor.orbitRadius * 0.7,
      );
      ref.rotation.x += 0.015;
      ref.rotation.y += 0.02;
    });
  });

  return (
    <group>
      {meteors.map((meteor, index) => (
        <group key={meteor.key} ref={(el) => { refs.current[index] = el; }}>
          <mesh>
            <dodecahedronGeometry args={[meteor.size, 0]} />
            <meshStandardMaterial color="#777d87" emissive="#342e26" emissiveIntensity={0.15} roughness={0.96} metalness={0.05} />
          </mesh>
          <mesh position={[-0.22, 0, 0]}>
            <coneGeometry args={[meteor.size * 0.72, meteor.size * 2, 8]} />
            <meshBasicMaterial color="#ffb86c" transparent opacity={0.16} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function BlackholeNode({ node }) {
  const ref = useRef(null);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.18;
  });

  return (
    <group position={node.position}>
      <group ref={ref}>
        <mesh>
          <sphereGeometry args={[node.radius * 0.44, 32, 32]} />
          <meshStandardMaterial color="#020409" emissive="#030509" emissiveIntensity={0.12} metalness={0.15} roughness={0.35} />
        </mesh>
        <EventHorizon radius={node.radius} color={node.color} />
      </group>
      <MeteorField count={3} spread={node.radius * 4.5} />
    </group>
  );
}

function SolarSystemNode({ node }) {
  const starRef = useRef(null);
  const orbitRef = useRef([]);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    if (starRef.current) starRef.current.rotation.y += delta * 0.14;
    orbitRef.current.forEach((planet, index) => {
      if (!planet) return;
      const orbit = node.orbiters[index];
      const angle = t * orbit.speed + orbit.seedAngle;
      planet.position.set(
        Math.cos(angle) * orbit.radius,
        Math.sin(angle * 0.5) * orbit.tilt,
        Math.sin(angle) * orbit.radius * 0.72,
      );
    });
  });

  return (
    <group position={node.position}>
      <mesh>
        <sphereGeometry args={[node.radius * 1.95, 32, 32]} />
        <meshBasicMaterial color="#ffd46b" transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <mesh ref={starRef}>
        <sphereGeometry args={[node.radius * 0.9, 32, 32]} />
        <meshStandardMaterial color="#ffd46b" emissive="#ffbf54" emissiveIntensity={1.1} metalness={0.15} roughness={0.38} />
      </mesh>
      {node.orbiters.map((orbit, index) => (
        <group key={orbit.key}>
          <mesh rotation={[Math.PI / 2 + orbit.tilt, 0, 0]}>
            <torusGeometry args={[orbit.radius, 0.015, 8, 96]} />
            <meshBasicMaterial color="white" transparent opacity={0.16} depthWrite={false} />
          </mesh>
          <mesh ref={(el) => { orbitRef.current[index] = el; }}>
            <sphereGeometry args={[orbit.size, 16, 16]} />
            <meshStandardMaterial color={orbit.color} emissive={orbit.color} emissiveIntensity={0.3} roughness={0.5} metalness={0.1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function DysonNode({ node }) {
  const ref = useRef(null);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.x += delta * 0.08;
      ref.current.rotation.y += delta * 0.12;
    }
  });

  return (
    <group position={node.position}>
      <mesh scale={node.radius * 2.2}>
        <sphereGeometry args={[1, 30, 30]} />
        <meshBasicMaterial color={node.color} transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <mesh ref={ref}>
        <icosahedronGeometry args={[node.radius * 0.9, 1]} />
        <meshStandardMaterial color={node.color} emissive={node.color} emissiveIntensity={0.44} metalness={0.72} roughness={0.18} />
      </mesh>
    </group>
  );
}

function RelayNode({ node }) {
  const ref = useRef(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.scale.setScalar(0.95 + Math.sin(clock.elapsedTime * 2.2 + node.position[0]) * 0.08);
  });

  return (
    <mesh ref={ref} position={node.position}>
      <sphereGeometry args={[node.radius, 10, 10]} />
      <meshBasicMaterial color={node.color} transparent opacity={0.5} depthWrite={false} />
    </mesh>
  );
}

function HeroLabels({ nodes, limit = 4 }) {
  return (
    <>
      {nodes.slice(0, limit).map((node) => (
        <group key={node.key} position={[node.position[0], node.position[1] + 2.5, node.position[2]]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.58, 0.68, 24]} />
            <meshBasicMaterial color={node.color} transparent opacity={0.18} depthWrite={false} />
          </mesh>
          <mesh position={[0, -0.6, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 1.2, 8]} />
            <meshBasicMaterial color={node.color} transparent opacity={0.25} depthWrite={false} />
          </mesh>
          <Html transform position={[0, 0.05, 0]} center distanceFactor={14}>
            <div className="universe-label">
              <strong>{node.label}</strong>
              <span>{node.kind}</span>
            </div>
          </Html>
        </group>
      ))}
    </>
  );
}

function CometTrail() {
  const ref = useRef(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * 0.22;
    ref.current.position.set(Math.cos(t) * 24, 10 + Math.sin(t * 1.8) * 5, Math.sin(t) * 16 - 8);
  });

  return (
    <Trail width={1.3} length={9} color={new THREE.Color('#dff8ff')} attenuation={(t) => t * t}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.34, 18, 18]} />
        <meshBasicMaterial color="#f7ffff" />
      </mesh>
    </Trail>
  );
}

function UniverseScene({ tier }) {
  const graph = useMemo(() => buildUniverseGraph(), []);
  const positions = useMemo(() => getNodePositionMap(graph), [graph]);

  return (
    <>
      <color attach="background" args={['#04101a']} />
      <fog attach="fog" args={['#06101a', 18, 96]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[8, 12, 8]} intensity={1.15} color="#dff8ff" />
      <pointLight position={[-16, 6, 8]} intensity={1.1} color="#9f7cff" />
      <pointLight position={[16, -4, 10]} intensity={0.95} color="#6dffb5" />
      <Stars radius={130} depth={68} count={tier.stars} factor={5.4} saturation={0} fade speed={1} />
      <CinematicDustField sparkleCount={tier.sparkles} />
      <MeteorField count={tier.meteors} spread={30} />

      {graph.routeLinks.map((link) => {
        const from = positions[link.from];
        const to = positions[link.to];
        if (!from || !to) return null;
        return <RouteRibbon key={link.key} from={from} to={to} color={link.color} arc={link.arc} faint={link.faint} />;
      })}

      {graph.nodes.map((node) => {
        if (node.kind === 'blackhole') return <BlackholeNode key={node.key} node={node} />;
        if (node.kind === 'solar') return <SolarSystemNode key={node.key} node={node} />;
        if (node.kind === 'dyson') return <DysonNode key={node.key} node={node} />;
        return <RelayNode key={node.key} node={node} />;
      })}

      <HeroLabels nodes={graph.heroNodes} limit={tier.labels} />
      <CometTrail />
    </>
  );
}

export default function CinematicUniverseCanvas({ className = '' }) {
  const tier = useDeviceTier();

  return (
    <div className={`cinematic-universe-shell ${className}`.trim()} aria-hidden="true">
      <div className="cinematic-universe-poster" />
      <div className="cinematic-universe-gradient" />
      <Canvas
        camera={{ position: [0, 8, 28], fov: tier.isMobile ? 50 : 44 }}
        dpr={tier.dpr}
        gl={{ antialias: !tier.isMobile, alpha: true, powerPreference: 'high-performance' }}
        eventSource={typeof document !== 'undefined' ? document.getElementById('__next') : undefined}
      >
        <UniverseScene tier={tier} />
      </Canvas>
    </div>
  );
}
