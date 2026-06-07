
'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, Stars, Trail } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';


const FALLBACK_DYSON_ANCHOR = {
  id: 'ss',
  label: 'S.S',
  anchorLabel: 'S.S',
  color: '#ffd15c',
  position: [5.15, 2.5, -0.45],
  href: 'https://synapticsystems.ca',
  sublabel: 'External site',
  anchorSublabel: 'Dyson sphere link',
  description: 'Opens SynapticSystems.ca.',
  external: true
};

function resolveDysonAnchorPayload(anchor) {
  const candidate = anchor && typeof anchor === 'object' ? anchor : {};
  const fallback = FALLBACK_DYSON_ANCHOR;
  const position = Array.isArray(candidate.position) && candidate.position.length >= 3
    ? [0, 1, 2].map((index) => {
        const value = Number(candidate.position[index]);
        return Number.isFinite(value) ? value : fallback.position[index];
      })
    : [...fallback.position];

  return {
    id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : fallback.id,
    label: typeof candidate.label === 'string' && candidate.label.trim() ? candidate.label : fallback.label,
    anchorLabel: typeof candidate.anchorLabel === 'string' && candidate.anchorLabel.trim() ? candidate.anchorLabel : fallback.anchorLabel,
    color: typeof candidate.color === 'string' && candidate.color.trim() ? candidate.color : fallback.color,
    position,
    href: typeof candidate.href === 'string' && candidate.href.trim() ? candidate.href : fallback.href,
    sublabel: typeof candidate.sublabel === 'string' && candidate.sublabel.trim() ? candidate.sublabel : fallback.sublabel,
    anchorSublabel: typeof candidate.anchorSublabel === 'string' && candidate.anchorSublabel.trim() ? candidate.anchorSublabel : fallback.anchorSublabel,
    description: typeof candidate.description === 'string' && candidate.description.trim() ? candidate.description : fallback.description,
    external: Boolean(candidate.external ?? fallback.external)
  };
}

const SOLAR_SYSTEM_PLAYABLE_ANCHOR = {
  label: 'Solar System',
  sublabel: 'Playable reference map · Arma3 CTH',
  position: [0, 0.4, 0],
  color: '#ffd46b',
  href: '/servers/arma3-cth',
  description: 'Primary web-playable solar-system anchor. Server routes and Dyson spheres attach as intelligence strings and datapoints.',
  playableAnchor: true,
  anchorRole: 'reference-map-solar-system',
};

const SERVER_NODES = [
  {
    label: 'Arma3 CTH',
    sublabel: 'tcentral.game.nfoservers.com:2302',
    position: [-3.2, 2.15, 0.3],
    color: '#8beaff',
    href: SOLAR_SYSTEM_PLAYABLE_ANCHOR.href,
    description: 'Attached playable-server datapoint resolved through the Solar System anchor.',
    type: 'arma',
    playableEntry: false,
    attachedTo: 'solar_system'
  },
  {
    label: 'Rust Bi-Weekly',
    sublabel: 'tcentralrust.game.nfoservers.com:28015',
    position: [1.4, -2.2, 0.7],
    color: '#d8ff61',
    href: SOLAR_SYSTEM_PLAYABLE_ANCHOR.href,
    description: 'Attached Rust-family datapoint; not a separate playable map entry.',
    cluster: 'rust',
    playableEntry: false,
    attachedTo: 'solar_system'
  },
  {
    label: 'Rust Monthly',
    sublabel: 'tcentralrust3.game.nfoservers.com:28015',
    position: [-1.6, -2.75, -0.15],
    color: '#ffd15c',
    href: SOLAR_SYSTEM_PLAYABLE_ANCHOR.href,
    description: 'Attached monthly Rust datapoint; not a separate playable map entry.',
    cluster: 'rust',
    playableEntry: false,
    attachedTo: 'solar_system'
  },
  {
    label: 'Rust Weekly',
    sublabel: 'tcentralrust2.game.nfoservers.com:28015',
    position: [3.05, -1.35, -0.3],
    color: '#ff9fda',
    href: SOLAR_SYSTEM_PLAYABLE_ANCHOR.href,
    description: 'Attached weekly Rust datapoint; not a separate playable map entry.',
    cluster: 'rust',
    playableEntry: false,
    attachedTo: 'solar_system'
  },
  {
    label: 'Player Reporting',
    sublabel: 'Moderation route',
    position: [4.15, 0.8, 0.2],
    color: '#ff8a8a',
    href: '/report-player',
    description: 'Moderation datapoint attached to the playable reference map.',
    playableEntry: false,
    attachedTo: 'solar_system'
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

function DysonSphere({ asset, position = [5.15, 2.5, -0.45], onSelect }) {
  const safeAsset = asset || {};
  const resolvedPosition = safeAsset.position || position;
  const resolvedColor = safeAsset.color || '#ffd15c';
  const resolvedLabel = safeAsset.label || 'S.S';
  const resolvedDescription = safeAsset.description || 'Opens SynapticSystems.ca.';
  const routeMetadata = safeAsset.route_metadata || {};
  const resolvedHref = routeMetadata.href || routeMetadata.route || 'https://synapticsystems.ca';
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
      position={resolvedPosition}
      onClick={(e) => {
        e.stopPropagation();
        onSelect({
          label: resolvedLabel,
          href: resolvedHref,
          position: resolvedPosition,
          sublabel: routeMetadata.sublabel || 'External site',
          description: resolvedDescription,
          external: routeMetadata.external ?? true
        });
      }}
    >
      <mesh>
        <sphereGeometry args={[0.42, 28, 28]} />
        <meshStandardMaterial color={resolvedColor} emissive={resolvedColor} emissiveIntensity={1.8} />
      </mesh>

      <mesh ref={ringA}>
        <torusGeometry args={[0.9, 0.03, 16, 140]} />
        <meshStandardMaterial color={resolvedColor} emissive={resolvedColor} emissiveIntensity={1.2} />
      </mesh>
      <mesh ref={ringB} rotation={[1.1, 0.3, 0.2]}>
        <torusGeometry args={[1.18, 0.025, 16, 140]} />
        <meshStandardMaterial color={resolvedColor} emissive={resolvedColor} emissiveIntensity={1.1} />
      </mesh>
      <mesh ref={ringC} rotation={[0.2, 0.7, 1.0]}>
        <torusGeometry args={[1.45, 0.02, 16, 140]} />
        <meshStandardMaterial color="#fff4c1" emissive="#fff4c1" emissiveIntensity={0.9} />
      </mesh>

      <pointLight position={[0, 0, 0]} color={resolvedColor} intensity={16} distance={10} />
      <Html position={[0, -1.38, 0]} center>
        <button
          className="map-anchor-label clickable"
          onClick={() =>
            onSelect({
              label: resolvedLabel,
              href: resolvedHref,
              position: resolvedPosition,
              sublabel: routeMetadata.sublabel || 'External site',
              description: resolvedDescription,
              external: routeMetadata.external ?? true
            })
          }
        >
          <span className="anchor-title">{resolvedLabel}</span>
          <span className="anchor-copy">Dyson sphere link</span>
        </button>
      </Html>
    </group>
  );
}


function SolarSystemPlayableAnchor({ anchor = SOLAR_SYSTEM_PLAYABLE_ANCHOR, onSelect }) {
  const core = useRef();
  const ringA = useRef();
  const ringB = useRef();

  useFrame((state, delta) => {
    if (core.current) {
      core.current.rotation.y += delta * 0.36;
      core.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 1.9) * 0.06);
    }
    if (ringA.current) ringA.current.rotation.z += delta * 0.18;
    if (ringB.current) ringB.current.rotation.x -= delta * 0.14;
  });

  return (
    <group
      position={anchor.position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(anchor);
      }}
    >
      <mesh ref={core}>
        <sphereGeometry args={[0.72, 36, 36]} />
        <meshStandardMaterial color={anchor.color} emissive={anchor.color} emissiveIntensity={2.1} roughness={0.28} />
      </mesh>
      <mesh ref={ringA} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.35, 0.035, 16, 160]} />
        <meshBasicMaterial color="#fff0a8" transparent opacity={0.65} />
      </mesh>
      <mesh ref={ringB} rotation={[0.7, 0.2, 0.4]}>
        <torusGeometry args={[1.85, 0.018, 12, 180]} />
        <meshBasicMaterial color="#7fe7ff" transparent opacity={0.42} />
      </mesh>
      <pointLight position={[0, 0, 0]} color={anchor.color} intensity={22} distance={13} />
      <Html position={[0, 1.55, 0]} center>
        <button className="map-anchor-label clickable playable-anchor" onClick={() => onSelect(anchor)}>
          <span className="anchor-title">Solar System Anchor</span>
          <span className="anchor-copy">reference-map-solar-system</span>
        </button>
      </Html>
    </group>
  );
}

function AnchorStringLines({ anchor = SOLAR_SYSTEM_PLAYABLE_ANCHOR, dysonAnchor }) {
  const targets = useMemo(() => [
    ...SERVER_NODES,
    { label: 'Synaptics Dyson datapoint', position: dysonAnchor.position, color: dysonAnchor.color },
    { label: 'Canada intelligence datapoint', position: [7.15, 4.2, -0.6], color: '#fff3a0' },
  ], [dysonAnchor]);

  return targets.map((target) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...anchor.position),
      new THREE.Vector3(...target.position),
    ]);
    return (
      <line key={`anchor-string-${target.label}`} geometry={geometry}>
        <lineBasicMaterial color={target.color || '#6de8ff'} transparent opacity={0.38} />
      </line>
    );
  });
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

function ConstellationLines({ dysonAnchor }) {
  const dysonPosition = dysonAnchor.position;
  const points = useMemo(() => SERVER_NODES.map((node) => new THREE.Vector3(...node.position)), []);
  const geometry = useMemo(() => {
    const ordered = [
      new THREE.Vector3(...SOLAR_SYSTEM_PLAYABLE_ANCHOR.position),
      points[0],
      points[1],
      points[2],
      points[3],
      points[4],
      new THREE.Vector3(...dysonPosition),
      new THREE.Vector3(7.15, 4.2, -0.6)
    ];
    const curve = new THREE.CatmullRomCurve3(ordered, false, 'catmullrom', 0.25);
    return new THREE.BufferGeometry().setFromPoints(curve.getPoints(260));
  }, [dysonPosition, points]);

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
          className={`map-node-label ${active ? 'active' : ''} ${node.playableEntry === false ? 'datapoint' : ''}`}
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

function Scene({ dysonAssets = [], onSelect }) {
  const [active, setActive] = useState('Solar System');
  const primaryDysonAsset = dysonAssets.find((asset) => asset.sphere_key === 'ss') || dysonAssets[0];
  const dysonAnchor = resolveDysonAnchorPayload(primaryDysonAsset);

  return (
    <>
      <ambientLight intensity={1.15} />
      <directionalLight position={[5, 6, 4]} intensity={1.5} color="#bdefff" />
      <pointLight position={[-6, 3, 4]} intensity={16} color="#6fdfff" distance={18} />
      <pointLight position={[6, 3, -2]} intensity={10} color="#b78dff" distance={18} />
      <fog attach="fog" args={['#060e16', 12, 28]} />
      <Stars radius={70} depth={30} count={3200} factor={4.2} saturation={0} fade speed={0.8} />

      <group rotation={[-0.15, -0.08, 0]}>
        <SectorRing position={SOLAR_SYSTEM_PLAYABLE_ANCHOR.position} radius={4.25} color="#ffd46b" label="Playable Solar Anchor" />
        <SectorRing position={dysonAnchor.position} radius={2.65} color={dysonAnchor.color} label="Dyson Datapoint" />

        <ConstellationLines dysonAnchor={dysonAnchor} />
        <AnchorStringLines dysonAnchor={dysonAnchor} />

        <SolarSystemPlayableAnchor onSelect={onSelect} />
        <group onClick={(e) => { e.stopPropagation(); onSelect({ ...SOLAR_SYSTEM_PLAYABLE_ANCHOR, label: 'Rust Cluster Datapoint', sublabel: 'String attached to Solar System', description: 'Rust server cluster rendered as a datapoint on the playable solar-system anchor.' }); }}>
          <BlackHole position={[1.15, -2.9, 0]} label="Rust Datapoint" sublabel="Solar string" />
        </group>

        <DysonSphere asset={{ ...dysonAnchor, route_metadata: { href: SOLAR_SYSTEM_PLAYABLE_ANCHOR.href, sublabel: 'Dyson datapoint on Solar System', external: false } }} onSelect={onSelect} />
        <ShiningStar onSelect={(item) => onSelect({ ...item, href: SOLAR_SYSTEM_PLAYABLE_ANCHOR.href, external: false, sublabel: 'Intelligence datapoint on Solar System' })} />

        {SERVER_NODES.map((node) => (
          <Node
            key={node.label}
            node={node}
            active={active === node.label}
            onHover={setActive}
            onLeave={() => setActive('Solar System')}
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
  const [dysonAssets, setDysonAssets] = useState([]);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/dyson-assets', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled || !Array.isArray(payload?.assets)) return;
        setDysonAssets(payload.assets.map((asset) => ({
          sphere_key: asset.sphere_key,
          label: asset.label,
          position: asset.position,
          color: asset.color,
          description: asset.description,
          route_metadata: asset.route_metadata,
          route_links: asset.route_links,
        })));
      })
      .catch(() => {
        if (!cancelled) setDysonAssets([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
          The Solar System now acts as the playable reference-map anchor. Server routes and Dyson spheres render as
          attached intelligence strings and datapoints, so the Arma playable handoff stays centralized instead
          of presenting every datapoint as a standalone playable entry.
        </p>
      </div>

      <div className="interactive-map-stage redesigned">
        <Canvas camera={{ position: [0, 1.5, 11], fov: 46 }}>
          <Scene dysonAssets={dysonAssets} onSelect={setSelected} />
        </Canvas>
        <FocusPanel item={selected} onClose={() => setSelected(null)} onOpen={openItem} />
      </div>
    </div>
  );
}
