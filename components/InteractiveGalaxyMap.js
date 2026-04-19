
'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, Stars, Trail } from '@react-three/drei';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';

const SERVER_NODES = [
  {
    label: 'Arma3 CTH',
    sublabel: 'tcentral.game.nfoservers.com:2302',
    position: [-5.6, 2.4, 0.3],
    color: '#8beaff',
    href: '/servers/arma3-cth',
    description: 'Public tactical hill-control combat.',
    type: 'arma'
  },
  {
    label: 'Rust Bi-Weekly',
    sublabel: 'tcentralrust.game.nfoservers.com:28015',
    position: [0.45, -2.7, 0.7],
    color: '#d8ff61',
    href: '/servers/rust-vanilla',
    description: 'Bi-weekly wipe cycle.',
    cluster: 'rust'
  },
  {
    label: 'Rust Monthly',
    sublabel: 'tcentralrust3.game.nfoservers.com:28015',
    position: [-2.35, -3.52, -0.15],
    color: '#ffd15c',
    href: '/servers/rust-monthly',
    description: 'Monthly progression cycle.',
    cluster: 'rust'
  },
  {
    label: 'Rust Weekly',
    sublabel: 'tcentralrust2.game.nfoservers.com:28015',
    position: [2.72, -3.42, -0.3],
    color: '#ff9fda',
    href: '/servers/rust-weekly',
    description: 'Weekly fresh-start cycle.',
    cluster: 'rust'
  },
  {
    label: 'Player Reporting',
    sublabel: 'Moderation route',
    position: [5.85, -0.25, 0.2],
    color: '#ff8a8a',
    href: '/report-player',
    description: 'Report rule violations.'
  }
];

function SectorRing({ position, radius = 3.8, color = '#4fe6ff', label }) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z += delta * 0.08;
  });
  return (
    <group position={position}>
      <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.02, 10, 220]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>
      <Html position={[0, radius + 0.55, 0]} center>
        <div className="sector-label">{label}</div>
      </Html>
    </group>
  );
}


function MatterStream({ radius = 2.9, color = '#b78dff', speed = 0.18, tilt = [Math.PI / 2.4, 0, 0], density = 36 }) {
  const group = useRef();
  const particles = useMemo(() => {
    return Array.from({ length: density }, (_, i) => {
      const angle = (i / density) * Math.PI * 2;
      const localRadius = radius + (Math.sin(i * 1.7) * 0.18);
      const y = (Math.cos(i * 0.9) * 0.08);
      const scale = 0.03 + (i % 5) * 0.008;
      return {
        angle,
        localRadius,
        y,
        scale,
        offset: i * 0.19
      };
    });
  }, [radius, density]);

  useFrame((state, delta) => {
    if (group.current) group.current.rotation.z += delta * speed;
  });

  return (
    <group ref={group} rotation={tilt}>
      {particles.map((p, i) => {
        const x = Math.cos(p.angle) * p.localRadius;
        const z = Math.sin(p.angle) * p.localRadius;
        return (
          <mesh key={i} position={[x, p.y, z]} scale={p.scale}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.75} transparent opacity={0.75} />
          </mesh>
        );
      })}
    </group>
  );
}

function BlackHole({ position = [0, -3.1, 0], label = 'Rust Cluster', sublabel = 'Lower singularity anchor', colorA = '#5f3fd5', colorB = '#86e7ff' }) {
  const group = useRef();
  const disc = useRef();

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.18;
    if (disc.current) disc.current.rotation.z -= delta * 0.35;
  });

  return (
    <group ref={group} position={position}>
      <mesh>
        <sphereGeometry args={[0.95, 48, 48]} />
        <meshStandardMaterial color="#020409" emissive="#060812" emissiveIntensity={0.9} />
      </mesh>

      <MatterStream radius={2.85} color={colorA} speed={0.12} tilt={[Math.PI / 2.45, 0.1, 0]} density={42} />
      <MatterStream radius={2.25} color={colorB} speed={-0.2} tilt={[Math.PI / 2.25, -0.15, 0.2]} density={28} />
      <mesh ref={disc} rotation={[Math.PI / 2.3, 0, 0]}>
        <torusGeometry args={[1.8, 0.36, 32, 140]} />
        <meshStandardMaterial color="#17111f" emissive={colorA} emissiveIntensity={1.1} transparent opacity={0.9} />
      </mesh>

      <mesh rotation={[Math.PI / 2.3, 0, 0]}>
        <torusGeometry args={[2.35, 0.1, 24, 140]} />
        <meshStandardMaterial color={colorB} emissive={colorB} emissiveIntensity={0.5} />
      </mesh>

      <pointLight position={[0, 0, 0]} color={colorA} intensity={35} distance={14} />
      <Html position={[0, -1.9, 0]} center>
        <div className="map-anchor-label">
          <span className="anchor-title">{label}</span>
          <span className="anchor-copy">{sublabel}</span>
        </div>
      </Html>
    </group>
  );
}

function ArmaBlackHole({ onSelect }) {
  const group = useRef();
  const disc = useRef();

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y -= delta * 0.14;
    if (disc.current) disc.current.rotation.z += delta * 0.42;
  });

  return (
    <group
      ref={group}
      position={[-5.6, 2.4, 0.3]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect({
          label: 'Arma3 CTH',
          href: '/servers/arma3-cth',
          position: [-5.6, 2.4, 0.3],
          sublabel: 'tcentral.game.nfoservers.com:2302',
          description: 'Public tactical hill-control combat.'
        });
      }}
    >
      <mesh>
        <sphereGeometry args={[0.82, 48, 48]} />
        <meshStandardMaterial color="#020409" emissive="#0a1a2a" emissiveIntensity={1.2} />
      </mesh>

      <MatterStream radius={2.55} color="#00eaff" speed={0.16} tilt={[Math.PI / 2.36, 0.2, 0]} density={38} />
      <MatterStream radius={1.95} color="#8beaff" speed={-0.24} tilt={[Math.PI / 2.18, -0.12, 0.18]} density={24} />
      <mesh ref={disc} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[1.6, 0.25, 32, 120]} />
        <meshStandardMaterial color="#00eaff" emissive="#00eaff" emissiveIntensity={1.4} />
      </mesh>

      <mesh rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[2.18, 0.08, 24, 120]} />
        <meshStandardMaterial color="#8beaff" emissive="#8beaff" emissiveIntensity={0.65} />
      </mesh>

      <pointLight position={[0, 0, 0]} color="#00eaff" intensity={30} distance={12} />
      <Html position={[0, 1.55, 0]} center>
        <button
          className="map-anchor-label clickable"
          onClick={() =>
            onSelect({
              label: 'Arma3 CTH',
              href: '/servers/arma3-cth',
              position: [-5.6, 2.4, 0.3],
              sublabel: 'tcentral.game.nfoservers.com:2302',
              description: 'Public tactical hill-control combat.'
            })
          }
        >
          <span className="anchor-title">Arma3 Black Hole</span>
          <span className="anchor-copy">Upper tactical anchor</span>
        </button>
      </Html>
    </group>
  );
}

function DysonSphere({ position = [5.15, 2.5, -0.45], onSelect }) {
  const group = useRef();
  const ringA = useRef();
  const ringB = useRef();
  const ringC = useRef();

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.18;
    if (ringA.current) ringA.current.rotation.x += delta * 0.45;
    if (ringB.current) ringB.current.rotation.y -= delta * 0.36;
    if (ringC.current) ringC.current.rotation.z += delta * 0.52;
  });

  return (
    <group
      ref={group}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect({
          label: 'S.S',
          href: 'https://synapticsystems.ca',
          position,
          sublabel: 'External site',
          description: 'Opens SynapticSystems.ca.',
          external: true
        });
      }}
    >
      <mesh>
        <sphereGeometry args={[0.42, 28, 28]} />
        <meshStandardMaterial color="#ffd15c" emissive="#ffd15c" emissiveIntensity={1.8} />
      </mesh>

      <mesh ref={ringA}>
        <torusGeometry args={[0.9, 0.03, 16, 140]} />
        <meshStandardMaterial color="#ffe694" emissive="#ffe694" emissiveIntensity={1.2} />
      </mesh>
      <mesh ref={ringB} rotation={[1.1, 0.3, 0.2]}>
        <torusGeometry args={[1.18, 0.025, 16, 140]} />
        <meshStandardMaterial color="#ffd15c" emissive="#ffd15c" emissiveIntensity={1.1} />
      </mesh>
      <mesh ref={ringC} rotation={[0.2, 0.7, 1.0]}>
        <torusGeometry args={[1.45, 0.02, 16, 140]} />
        <meshStandardMaterial color="#fff4c1" emissive="#fff4c1" emissiveIntensity={0.9} />
      </mesh>

      <pointLight position={[0, 0, 0]} color="#ffd15c" intensity={16} distance={10} />
      <Html position={[0, -1.38, 0]} center>
        <button
          className="map-anchor-label clickable"
          onClick={() =>
            onSelect({
              label: 'S.S',
              href: 'https://synapticsystems.ca',
              position,
              sublabel: 'External site',
              description: 'Opens SynapticSystems.ca.',
              external: true
            })
          }
        >
          <span className="anchor-title">S.S</span>
          <span className="anchor-copy">Dyson sphere link</span>
        </button>
      </Html>
    </group>
  );
}

function ShiningStar({ position = [7.15, 4.2, -0.6], onSelect }) {
  const core = useRef();
  const flareA = useRef();
  const flareB = useRef();

  useFrame((state, delta) => {
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.12;
    if (core.current) {
      core.current.scale.setScalar(pulse);
      core.current.rotation.y += delta * 0.4;
    }
    if (flareA.current) flareA.current.rotation.z += delta * 0.45;
    if (flareB.current) flareB.current.rotation.z -= delta * 0.32;
  });

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect({
          label: 'National Security',
          href: 'https://www.canada.ca/en/security-intelligence-service/corporate/reporting-national-security-information.html',
          position,
          sublabel: 'Canada reporting page',
          description: 'External Government of Canada reporting resource.',
          external: true
        });
      }}
    >
      <mesh ref={core}>
        <octahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial color="#fff3a0" emissive="#fff3a0" emissiveIntensity={2.3} />
      </mesh>

      <mesh ref={flareA} rotation={[0, 0, 0.3]}>
        <torusGeometry args={[0.72, 0.028, 12, 90]} />
        <meshStandardMaterial color="#fff7c7" emissive="#fff7c7" emissiveIntensity={1.1} />
      </mesh>

      <mesh ref={flareB} rotation={[0.6, 0.4, 0.9]}>
        <torusGeometry args={[1.02, 0.02, 12, 90]} />
        <meshStandardMaterial color="#fff3a0" emissive="#fff3a0" emissiveIntensity={0.95} />
      </mesh>

      <pointLight position={[0, 0, 0]} color="#fff3a0" intensity={14} distance={10} />
      <Html position={[0, 1.15, 0]} center>
        <button
          className="map-anchor-label clickable star-link"
          onClick={() =>
            onSelect({
              label: 'National Security',
              href: 'https://www.canada.ca/en/security-intelligence-service/corporate/reporting-national-security-information.html',
              position,
              sublabel: 'Canada reporting page',
              description: 'External Government of Canada reporting resource.',
              external: true
            })
          }
        >
          <span className="anchor-title">National Security Star</span>
          <span className="anchor-copy">Canada resource</span>
        </button>
      </Html>
    </group>
  );
}

function ConstellationLines() {
  const points = useMemo(() => SERVER_NODES.map((node) => new THREE.Vector3(...node.position)), []);
  const geometry = useMemo(() => {
    const ordered = [
      points[1],
      points[2],
      points[3],
      new THREE.Vector3(0, -3.1, 0),
      new THREE.Vector3(-5.6, 2.4, 0.3),
      points[4],
      new THREE.Vector3(5.15, 2.5, -0.45),
      new THREE.Vector3(7.15, 4.2, -0.6)
    ];
    const curve = new THREE.CatmullRomCurve3(ordered, false, 'catmullrom', 0.25);
    return new THREE.BufferGeometry().setFromPoints(curve.getPoints(260));
  }, [points]);

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color="#6de8ff" transparent opacity={0.35} />
    </line>
  );
}

function Node({ node, active, onHover, onLeave, onSelect }) {
  const mesh = useRef();

  useFrame((state) => {
    if (!mesh.current) return;
    mesh.current.position.y = node.position[1] + Math.sin(state.clock.elapsedTime * 1.2 + node.position[0]) * 0.08;
    mesh.current.rotation.y += 0.012;
  });

  return (
    <group position={node.position}>
      <Trail width={0.4} length={2.5} color={node.color} attenuation={(t) => t * t}>
        <mesh
          ref={mesh}
          onPointerOver={(e) => { e.stopPropagation(); onHover(node.label); }}
          onPointerOut={(e) => { e.stopPropagation(); onLeave(); }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(node);
          }}
        >
          <icosahedronGeometry args={[active ? 0.34 : 0.28, 1]} />
          <meshStandardMaterial
            color={node.color}
            emissive={node.color}
            emissiveIntensity={active ? 1.6 : 0.95}
            roughness={0.2}
            metalness={0.15}
          />
        </mesh>
      </Trail>

      <mesh>
        <sphereGeometry args={[active ? 0.62 : 0.52, 24, 24]} />
        <meshBasicMaterial color={node.color} transparent opacity={active ? 0.18 : 0.1} />
      </mesh>

      <Html center distanceFactor={8.5} position={[0, active ? 0.92 : 0.78, 0]}>
        <button
          className={`map-node-label ${active ? 'active' : ''}`}
          onMouseEnter={() => onHover(node.label)}
          onMouseLeave={onLeave}
          onClick={() => onSelect(node)}
        >
          <strong>{node.label}</strong>
          <span>{node.sublabel}</span>
          <em>{node.description}</em>
        </button>
      </Html>
    </group>
  );
}

function Scene({ onSelect }) {
  const [active, setActive] = useState('Rust Bi-Weekly');

  return (
    <>
      <ambientLight intensity={1.15} />
      <directionalLight position={[5, 6, 4]} intensity={1.5} color="#bdefff" />
      <pointLight position={[-6, 3, 4]} intensity={16} color="#6fdfff" distance={18} />
      <pointLight position={[6, 3, -2]} intensity={10} color="#b78dff" distance={18} />
      <fog attach="fog" args={['#060e16', 12, 28]} />
      <Stars radius={70} depth={30} count={3200} factor={4.2} saturation={0} fade speed={0.8} />

      <group rotation={[-0.15, -0.08, 0]}>
        <SectorRing position={[-5.6, 2.4, 0.3]} radius={3.15} color="#58dfff" label="Arma Sector" />
        <SectorRing position={[0, -3.1, 0]} radius={3.8} color="#b78dff" label="Rust Sector" />
        <SectorRing position={[5.15, 2.5, -0.45]} radius={2.65} color="#ffd15c" label="Support Sector" />

        <ConstellationLines />

        <group onClick={(e) => { e.stopPropagation(); onSelect({ label: 'Rust Cluster', href: '/servers/rust-vanilla', position: [0, -3.1, 0], sublabel: 'Lower singularity anchor', description: 'Rust server cluster anchor.' }); }}>
          <BlackHole />
        </group>

        <ArmaBlackHole onSelect={onSelect} />
        <DysonSphere onSelect={onSelect} />
        <ShiningStar onSelect={onSelect} />

        {SERVER_NODES.map((node) => (
          <Node
            key={node.label}
            node={node}
            active={active === node.label}
            onHover={setActive}
            onLeave={() => setActive('Rust Bi-Weekly')}
            onSelect={onSelect}
          />
        ))}
      </group>

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={4}
        maxDistance={24}
        autoRotate={false}
        zoomSpeed={0.9}
        rotateSpeed={0.6}
        panSpeed={0.6}
        maxPolarAngle={Math.PI * 0.9}
        minPolarAngle={Math.PI * 0.1}
      />
    </>
  );
}

function FocusPanel({ item, onClose, onOpen }) {
  if (!item) return null;

  return (
    <div className="map-focus-panel">
      <div className="map-focus-header">
        <div>
          <p className="eyebrow">Selected node</p>
          <h4>{item.label}</h4>
        </div>
        <button className="focus-close" onClick={onClose}>×</button>
      </div>
      <p className="muted">{item.description}</p>
      <div className="focus-meta">
        <span>{item.sublabel}</span>
      </div>
      <div className="button-column">
        <button className="button primary" onClick={() => onOpen(item)}>
          Open destination
        </button>
        <button className="button secondary" onClick={onClose}>
          Clear selection
        </button>
      </div>
    </div>
  );
}

export default function InteractiveGalaxyMap() {
  const router = useRouter();
  const [selected, setSelected] = useState(null);

  const openItem = (item) => {
    if (!item) return;
    if (item.external) {
      window.open(item.href, '_blank', 'noopener,noreferrer');
    } else {
      router.push(item.href);
    }
  };

  return (
    <div className="interactive-map-shell">
      <div className="interactive-map-copy">
        <p className="eyebrow">3D system map</p>
        <h3>Free camera navigation with a cleaner focus-based interaction flow.</h3>
        <p className="muted">
          The map no longer forces the camera into anchored warp positions. You can move freely, rotate, zoom,
          and pan through the system yourself. Clicking any anchor or node now opens a focus panel so the
          interaction feels more deliberate and easier to control.
        </p>
      </div>

      <div className="interactive-map-stage redesigned">
        <Canvas camera={{ position: [0, 1.5, 11], fov: 46 }}>
          <Scene onSelect={setSelected} />
        </Canvas>
        <FocusPanel item={selected} onClose={() => setSelected(null)} onOpen={openItem} />
      </div>
    </div>
  );
}
