'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSteamSession } from '@/components/SteamSessionProvider';
import { buildUniverseGraph, getNodePositionMap } from '@/lib/universeEngine';
import { createPrivateWorldAsset } from '@/lib/privateWorldAsset';
import { summarizeEpochRelativity } from '@/lib/epochDysonEngine';
import { createGravitySources } from '@/lib/physicsEngine';
import { buildGravitySourcesFromSeed } from '@/lib/simCore/stepFrame';
import { createQuantumState, summarizeQuantumState, evolveQuantumState } from '@/lib/quantumFieldEngine';
import { createSimulationRuntimeClient } from '@/lib/simRuntime/client';
import { SIM_RUNTIME_STATUS } from '@/lib/simRuntime/contracts';
import { useMultiplayerSession } from '@/components/MultiplayerSessionProvider';
import { resolveMultiplayerIdentity } from '@/lib/multiplayerSyncEngine';
import { buildAccountSnapshot, defaultProgressState, getAccountStorageKey, normalizeProgressState } from '@/lib/accountProgression';
import { SESSION_MODES } from '@/lib/sessionModeEngine';
import { BlackHoleVisual, CinematicBloom, DeepSpaceScenery, InterceptorHull, PlanetSurface, StellarSurface } from '@/components/SimulationVisuals';
import { getGraphicsProfile } from '@/lib/graphicsProfile';
import TouchFlightPad from '@/components/TouchFlightPad';
import ExplorationHud from '@/components/ExplorationHud';
import DestinationBearing from '@/components/DestinationBearing';
import useSharedFlight from '@/components/useSharedFlight';
import { distanceBetween, getApproachPoint, getCruiseControl, getExplorationDestinations } from '@/lib/exploration';
import { isValidRoomName } from '@/lib/exploration';
import { FLIGHT_KEYS, isInteractiveTarget, shouldIgnoreFlightKey } from '@/lib/flightInput';
import { gameEngine } from '@/lib/gameEngine';
import PrayerSeedRelic from '@/components/PrayerSeedRelic';
import PrayerSeedEncounter from '@/components/PrayerSeedEncounter';

const SIM_RENDERER_OPTIONS = { antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 };
const SHIP_MODEL_FORWARD = new THREE.Vector3(0, 0, 1);
const SHIP_CAMERA_BACK = new THREE.Vector3(0, 0, -1);
const FLIGHT_PRESETS = Object.freeze({
  assisted: { thrustScale: 1, inertialDampers: true, chaseZoom: 1, routeAssist: true, mouseLook: false, sixAxis: false },
  freeFlight: { thrustScale: 1.45, inertialDampers: false, chaseZoom: 1.24, routeAssist: false, mouseLook: true, sixAxis: true }
});

function useDeviceTier() {
  const [tier, setTier] = useState({ isMobile: false, dpr: [1, 1.6], stars: 7600, sparkles: 220, meteors: 18 });

  useEffect(() => {
    const update = () => {
      const isMobile = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;
      setTier({
        isMobile,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        dpr: isMobile ? [1, 1.2] : [1, 1.6],
        stars: isMobile ? 3600 : 7600,
        sparkles: isMobile ? 120 : 220,
        meteors: isMobile ? 8 : 18,
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return tier;
}

function RouteBeam({ from, to, color = '#67dfff', arc = 1.8, opacity = 0.18, radius = 0.04 }) {
  const points = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = start.clone().lerp(end, 0.5);
    mid.y += arc;
    return [start, mid, end];
  }, [from, to, arc]);

  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  const beamRef = useRef(null);

  useFrame(({ clock }) => {
    if (!beamRef.current) return;
    beamRef.current.material.opacity = opacity * (.85 + Math.sin(clock.elapsedTime * 1.4) * .15);
  });

  return (
    <mesh ref={beamRef}>
      <tubeGeometry args={[curve, 64, radius, 6, false]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}

function EventHorizon({ radius = 1.25, animate = true }) {
  return <BlackHoleVisual radius={radius * .66} animate={animate} />;
}

function MeteorSwarm({ count = 10, radius = 24 }) {
  const group = useRef(null);
  const meteors = useMemo(
    () => Array.from({ length: count }, (_, index) => ({
      key: `meteor-${index}`,
      orbitRadius: radius + (index % 4) * 3.6,
      speed: 0.12 + (index % 5) * 0.03,
      angle: (Math.PI * 2 * index) / count,
      height: ((index % 5) - 2) * 1.1,
      size: 0.08 + (index % 3) * 0.04,
    })),
    [count, radius]
  );

  useFrame(({ clock }) => {
    meteors.forEach((meteor, index) => {
      const mesh = group.current?.children?.[index];
      if (!mesh) return;
      const angle = clock.elapsedTime * meteor.speed + meteor.angle;
      mesh.position.set(
        Math.cos(angle) * meteor.orbitRadius,
        meteor.height + Math.sin(angle * 2.4) * 0.5,
        Math.sin(angle) * meteor.orbitRadius * 0.74,
      );
      mesh.rotation.x += 0.02;
      mesh.rotation.y += 0.03;
    });
  });

  return (
    <group ref={group}>
      {meteors.map((meteor) => (
        <group key={meteor.key}>
          <mesh>
            <dodecahedronGeometry args={[meteor.size, 0]} />
            <meshStandardMaterial color="#7a7c86" emissive="#352f26" emissiveIntensity={0.16} roughness={0.95} metalness={0.08} />
          </mesh>
          <mesh position={[-0.22, 0, 0]}>
            <coneGeometry args={[meteor.size * 0.7, meteor.size * 1.8, 8]} />
            <meshBasicMaterial color="#ffb86c" transparent opacity={0.18} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function GravityFieldRings({ position = [0, 0, 0], color = '#7fe7ff' }) {
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[4.6, 0.018, 8, 140]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2.2, Math.PI / 6, 0]}>
        <torusGeometry args={[6.2, 0.014, 8, 140]} />
        <meshBasicMaterial color="#dff8ff" transparent opacity={0.08} depthWrite={false} />
      </mesh>
    </group>
  );
}

function PrivateMapAssetStructure({ color = '#91f2ff' }) {
  const frameRef = useRef(null);
  const meshRef = useRef(null);

  useFrame(({ clock }, delta) => {
    if (frameRef.current) frameRef.current.rotation.y += delta * 0.18;
    if (meshRef.current) meshRef.current.rotation.z -= delta * 0.11;
    meshRef.current?.children?.forEach((child, index) => {
      child.rotation.y = clock.elapsedTime * (0.12 + index * 0.04);
    });
  });

  return (
    <group>
      <mesh ref={frameRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.28, 0.08, 16, 112]} />
        <meshStandardMaterial color={color} metalness={0.88} roughness={0.14} emissive={color} emissiveIntensity={0.22} />
      </mesh>
      <group ref={meshRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.92, 0.02, 10, 112]} />
          <meshBasicMaterial color="#dffcff" transparent opacity={0.42} depthWrite={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2.4, Math.PI / 4, 0]}>
          <torusGeometry args={[0.72, 0.02, 10, 112]} />
          <meshBasicMaterial color={color} transparent opacity={0.26} depthWrite={false} />
        </mesh>
      </group>
      <mesh>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial color="#04060c" emissive="#000000" roughness={0.18} metalness={0.28} />
      </mesh>
      <mesh scale={1.7}>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshBasicMaterial color="#b8f7ff" transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.38, 0.04, 10, 72]} />
        <meshBasicMaterial color="#d7f7ff" transparent opacity={0.72} depthWrite={false} />
      </mesh>
    </group>
  );
}


function DockingStationStructure({ color = '#9fe6ff' }) {
  const ringRef = useRef(null);
  const armRef = useRef(null);

  useFrame((_, delta) => {
    if (ringRef.current) ringRef.current.rotation.y += delta * 0.46;
    if (armRef.current) armRef.current.rotation.z -= delta * 0.32;
  });

  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.24, 0.34, 2.2, 18]} />
        <meshStandardMaterial color="#6f84a4" metalness={0.84} roughness={0.24} emissive="#11263a" emissiveIntensity={0.22} />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.12, 0.12, 16, 96]} />
        <meshStandardMaterial color={color} metalness={0.88} roughness={0.16} emissive={color} emissiveIntensity={0.32} />
      </mesh>
      <mesh ref={armRef} position={[0, 0.22, 0]} rotation={[0.42, 0, Math.PI / 4]}>
        <torusGeometry args={[0.62, 0.05, 12, 64]} />
        <meshStandardMaterial color="#dff8ff" metalness={0.9} roughness={0.12} emissive="#91f2ff" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0.86, 0.12, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.18, 0.56, 0.18]} />
        <meshStandardMaterial color="#7fa7c8" metalness={0.78} roughness={0.22} />
      </mesh>
      <mesh position={[-0.86, 0.12, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.18, 0.56, 0.18]} />
        <meshStandardMaterial color="#7fa7c8" metalness={0.78} roughness={0.22} />
      </mesh>
      <mesh position={[0, -0.98, 0]}>
        <coneGeometry args={[0.16, 0.78, 14]} />
        <meshBasicMaterial color="#90e8ff" transparent opacity={0.72} depthWrite={false} />
      </mesh>
    </group>
  );
}


function CsisNetworkLinks({ pulse = 0.5 }) {
  const linkGroup = useRef(null);
  useFrame((_, delta) => {
    if (linkGroup.current) linkGroup.current.rotation.y += delta * (0.24 + pulse * 0.12);
  });

  return (
    <group ref={linkGroup}>
      {Array.from({ length: 6 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 6;
        return (
          <group key={`csis-link-${index}`} rotation={[0, angle, 0]}>
            <mesh position={[0, 0, 0.98]} rotation={[0.24, 0, 0]}>
              <cylinderGeometry args={[0.024, 0.024, 2.24, 10]} />
              <meshBasicMaterial color="#7fe7ff" transparent opacity={0.3 + pulse * 0.22} depthWrite={false} />
            </mesh>
            <mesh position={[0, 0, 2.04]}>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshBasicMaterial color="#dff8ff" transparent opacity={0.58} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function CsisFirewallShell({ sweep = 0 }) {
  const shellRef = useRef(null);
  const bladeRef = useRef(null);

  useFrame((_, delta) => {
    if (shellRef.current) shellRef.current.rotation.y -= delta * 0.92;
    if (bladeRef.current) bladeRef.current.rotation.z = sweep;
  });

  return (
    <group>
      <mesh ref={shellRef}>
        <sphereGeometry args={[2.78, 28, 28]} />
        <meshBasicMaterial color="#9feeff" transparent opacity={0.07} wireframe depthWrite={false} />
      </mesh>
      <group ref={bladeRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.62, 0.05, 12, 96, Math.PI * 0.62]} />
          <meshBasicMaterial color="#dff8ff" transparent opacity={0.34} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

function DysonSphereStructure({ node, sessionMode = SESSION_MODES.IDLE, ringAdjustments = null }) {
  const coreRef = useRef(null);
  const segmentRef = useRef(null);
  const ringOneRef = useRef(null);
  const ringTwoRef = useRef(null);
  const ringThreeRef = useRef(null);
  const profile = node.dysonProfile || 'default';
  const csisState = node.csisState || {};
  const dysonState = node.dysonState || {};
  const isSynaptics = profile === 'synaptics' || node.key === 'ss';
  const dysonTagVariantClass = node.key === 'csis'
    ? 'dyson-logic-tag--csis'
    : node.key === 'ss'
      ? 'dyson-logic-tag--synaptics'
      : '';
  const ringThreeSpinRef = useRef(0);
  const ringThreePulseRef = useRef(0.12);
  const resolvedRingAdjustments = ringAdjustments || node?.dysonState?.ringAdjustments || {};

  useFrame(({ clock }, delta) => {
    if (coreRef.current) coreRef.current.rotation.y += delta * (isSynaptics ? 0.24 : 0.18);
    if (segmentRef.current) segmentRef.current.rotation.y += delta * (profile === 'synaptics' ? 0.42 : profile === 'ss' ? 0.36 : 0.24);
    if (ringOneRef.current) ringOneRef.current.rotation.z += delta * (profile === 'csis' ? 0.68 : isSynaptics ? 0.56 : 0.44);
    if (ringTwoRef.current) ringTwoRef.current.rotation.x -= delta * (profile === 'csis' ? 1.12 : isSynaptics ? 0.33 : 0.28);
    if (ringThreeRef.current) {
      const baseSpin = isSynaptics ? 0.92 : 0.21;
      const requestedSpin = sessionMode === SESSION_MODES.MULTI_PLAYER
        ? baseSpin * (0.1 + (resolvedRingAdjustments.ringThreeSpinIntensity || 0))
        : 0;
      ringThreeSpinRef.current += (requestedSpin - ringThreeSpinRef.current) * 0.12;
      ringThreeRef.current.rotation.y += delta * ringThreeSpinRef.current;

      const requestedPulse = 0.02 + ((resolvedRingAdjustments.ringThreePulse || 0.12) * 0.08);
      ringThreePulseRef.current += (requestedPulse - ringThreePulseRef.current) * 0.1;
      const pulse = 1 + Math.sin(clock.elapsedTime * 2.8 + (dysonState.latticePhase || 0)) * ringThreePulseRef.current;
      ringThreeRef.current.scale.setScalar(pulse);
    }
    if (profile === 'csis' && ringTwoRef.current) {
      ringTwoRef.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.2) * 0.04);
    }
  });

  return (
    <group>
      {isSynaptics ? (
        <mesh scale={1.32}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial color="#ffdca3" transparent opacity={0.08} depthWrite={false} />
        </mesh>
      ) : null}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[isSynaptics ? 1.02 : 0.94, 1]} />
        <meshStandardMaterial color={isSynaptics ? '#fff0c4' : node.color || '#9fdcff'} emissive={isSynaptics ? '#ffbe63' : node.color || '#9fdcff'} emissiveIntensity={isSynaptics ? 0.62 : 0.42} metalness={0.8} roughness={0.18} />
      </mesh>
      <group ref={segmentRef}>
        {Array.from({ length: isSynaptics ? 12 : 8 }, (_, index) => {
          const total = isSynaptics ? 12 : 8;
          const angle = (Math.PI * 2 * index) / total;
          const radius = isSynaptics ? 1.74 : profile === 'ss' ? 1.55 : 1.42;
          return (
            <mesh key={`segment-${index}`} position={[Math.cos(angle) * radius, Math.sin(angle * 1.4) * 0.18, Math.sin(angle) * radius * 0.72]} rotation={[0.12, angle, 0]}>
              <boxGeometry args={[isSynaptics ? 0.62 : 0.5, 0.15, isSynaptics ? 0.28 : 0.24]} />
              <meshStandardMaterial color={isSynaptics ? '#ffe3a1' : profile === 'ss' ? '#ffdf91' : '#9feeff'} metalness={0.86} roughness={0.16} emissive={isSynaptics ? '#ffc461' : profile === 'ss' ? '#ffb95a' : '#7fe7ff'} emissiveIntensity={0.24} />
            </mesh>
          );
        })}
      </group>
      <mesh ref={ringOneRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[isSynaptics ? 1.96 : profile === 'ss' ? 1.88 : 1.78, profile === 'csis' ? 0.08 : isSynaptics ? 0.1 : 0.11, 20, 140]} />
        <meshStandardMaterial color={profile === 'csis' ? '#7fe7ff' : isSynaptics ? '#ffd980' : '#ffe39f'} metalness={0.9} roughness={0.12} emissive={profile === 'csis' ? '#6befff' : isSynaptics ? '#ffcc5f' : '#ffd46b'} emissiveIntensity={0.3} />
      </mesh>
      <mesh ref={ringTwoRef} rotation={[Math.PI / 2.4, Math.PI / 5, 0]}>
        <torusGeometry args={[profile === 'csis' ? 2.34 : isSynaptics ? 2.42 : 2.18, profile === 'csis' ? 0.12 : isSynaptics ? 0.08 : 0.05, 18, 140]} />
        <meshStandardMaterial color={profile === 'csis' ? '#c9f6ff' : isSynaptics ? '#ffeeba' : '#dff8ff'} metalness={0.94} roughness={0.08} emissive={profile === 'csis' ? '#9feeff' : isSynaptics ? '#ffe38d' : '#c9f6ff'} emissiveIntensity={profile === 'csis' ? 0.38 : isSynaptics ? 0.34 : 0.18} transparent opacity={profile === 'csis' ? 0.88 : isSynaptics ? 0.82 : 0.42} />
      </mesh>
      {isSynaptics ? (
        <group ref={ringThreeRef}>
          <mesh rotation={[Math.PI / 2, 0, Math.PI / 6]}>
            <torusGeometry args={[2.86, 0.05, 12, 160]} />
            <meshStandardMaterial color="#a8f3ff" emissive="#7fe7ff" emissiveIntensity={0.72} metalness={0.92} roughness={0.08} transparent opacity={0.9} />
          </mesh>
          {Array.from({ length: 18 }, (_, index) => {
            const angle = (Math.PI * 2 * index) / 18;
            return (
              <mesh key={`encrypt-${index}`} position={[Math.cos(angle) * 2.86, Math.sin(angle * 1.1) * 0.16, Math.sin(angle) * 2.18]} rotation={[0.28, angle, 0]}>
                <boxGeometry args={[0.18, 0.04, 0.08]} />
                <meshBasicMaterial color="#d9fbff" transparent opacity={0.72} depthWrite={false} />
              </mesh>
            );
          })}
        </group>
      ) : null}
      {profile === 'csis' ? <CsisNetworkLinks pulse={csisState.linkagePulse || 0.5} /> : null}
      {profile === 'csis' ? <CsisFirewallShell sweep={csisState.firewallSweep || 0} /> : null}
      {profile === 'csis' ? (
        <group />
      ) : null}
      {isSynaptics ? (
        <group />
      ) : null}
    </group>
  );
}


function SolarSubSystem({ node, animate = true }) {
  const orbitRefs = useRef([]);
  const stellarProfile = node.stellarProfile || {};
  const starColor = stellarProfile.color || node.color || '#ffd46b';
  const luminosity = stellarProfile.luminositySolar || 1;
  const radiusScale = 1 + Math.min((stellarProfile.radiusSolar || 1) * 0.12, 0.35);

  useFrame(({ clock }, delta) => {

    node.orbiters?.forEach((orbit, index) => {
      const planet = orbitRefs.current[index];
      if (!planet) return;
      const angle = clock.elapsedTime * orbit.speed + orbit.seedAngle + (node.epochAnchor?.phase || 0) * Math.PI * 2;
      const semiMajor = orbit.radius;
      const semiMinor = orbit.radius * Math.sqrt(Math.max(0.68, 1 - (orbit.eccentricity || 0) ** 2)) * 0.72;
      planet.position.set(
        Math.cos(angle) * semiMajor,
        Math.sin(angle * 0.5) * orbit.tilt,
        Math.sin(angle) * semiMinor,
      );
    });
  });

  return (
    <group>
      <StellarSurface radius={1.15 * radiusScale} color={starColor} animate={animate} />
      {node.orbiters?.map((orbit, index) => (
        <group key={orbit.key}>
          <mesh rotation={[Math.PI / 2 + orbit.tilt, 0, 0]}>
            <torusGeometry args={[orbit.radius, 0.015, 8, 96]} />
            <meshBasicMaterial color={orbit.zone === 'habitable' ? '#b2ffd9' : '#dff8ff'} transparent opacity={orbit.zone === 'habitable' ? 0.065 : 0.035} depthWrite={false} />
          </mesh>
          <group ref={(el) => { orbitRefs.current[index] = el; }}>
            <PlanetSurface radius={orbit.size} color={orbit.color} gas={index > 3} segments={32} />
          </group>
        </group>
      ))}
      <group />
    </group>
  );
}

function NodeVisual({ node, onSelect, selectedKey, graphNode, condensedLabels = false, animate = true, sessionMode = SESSION_MODES.IDLE, ringAdjustments = null }) {
  const isBlackhole = node.kind === 'blackhole';
  const isDyson = node.kind === 'dyson';
  const isSolar = node.kind === 'solar';
  const isMapAsset = Boolean(node.mapAsset && node.kind === 'node');
  const spinRef = useRef(null);
  const securityState = graphNode?.securityState || node.securityState || 'open';
  const quarantined = securityState === 'quarantined';

  useFrame(({ clock }, delta) => {
    if (spinRef.current) spinRef.current.rotation.y += delta * (isBlackhole ? 0.42 : isDyson ? 0.3 : 0.14);

  });

  return (
    <group position={node.position || [0, 0, 0]}>
      {isSolar ? <group onClick={() => onSelect(node)}><SolarSubSystem node={graphNode || node} animate={animate} /></group> : null}

      <group ref={spinRef} scale={quarantined ? 0.88 : 1}>
        {isBlackhole ? (
          <>
            <mesh onClick={() => onSelect(node)}>
              <sphereGeometry args={[0.46, 24, 24]} />
              <meshStandardMaterial color="#020409" emissive="#000000" roughness={0.32} metalness={0.2} />
            </mesh>
            <EventHorizon radius={1.08} animate={animate} />
          </>
        ) : isDyson ? (
          <group onClick={() => onSelect(node)}>
            <DysonSphereStructure node={node} sessionMode={sessionMode} ringAdjustments={ringAdjustments} />
          </group>
        ) : isMapAsset ? (
          <group onClick={() => onSelect(node)}>
            <PrivateMapAssetStructure color={node.color || '#91f2ff'} />
          </group>
        ) : node.structureProfile === 'docking_station' ? (
          <group onClick={() => onSelect(node)}>
            <DockingStationStructure color={node.color || '#9fdcff'} />
          </group>
        ) : !isSolar ? (
          <mesh onClick={() => onSelect(node)} scale={node.generated ? 0.7 : 1}>
            <sphereGeometry args={[node.generated ? 0.32 : 0.55, 18, 18]} />
            <meshStandardMaterial color={node.color || '#9fdcff'} emissive={node.color || '#9fdcff'} emissiveIntensity={node.generated ? 0.16 : 0.22} metalness={0.18} roughness={0.45} />
          </mesh>
        ) : null}
      </group>

      {selectedKey === node.key && (isBlackhole || isSolar || isMapAsset) ? <GravityFieldRings position={[0, 0, 0]} color={node.color || '#9fdcff'} /> : null}
      {node.key === 'deep_blackhole' ? <MeteorSwarm count={12} radius={8.6} /> : null}


    </group>
  );
}

function FlightRig({ simRuntimeClient, gravitySources, onNearestChange, onTelemetryChange, onCombatAction, touchInput, isMobile = false, authenticated = false, epochSummary = null, flightConfig = null, multiplayerMode = false, simulationSeed = 'tcentral-main', simulationGravitySources = [], onSimulationFrame = null, correctionState = null, resetTick = 0, navigationCommand, cruising, onManualControl, onArrival, explorationNodes = [] }) {
  const groupRef = useRef(null);
  const engineCoreRef = useRef(null);
  const enginePortRef = useRef(null);
  const engineStarboardRef = useRef(null);
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const yaw = useRef(0);
  const pitch = useRef(-0.08);
  const roll = useRef(0);
  const keys = useRef({});
  const cruiseTarget = useRef(null);
  const lastGravity = useRef([0, 0, 0]);
  const { camera, gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    let lookPointer = null;
    const clearInput = () => {
      keys.current = {};
      lookPointer = null;
      // Background tabs can stop rendering while network timers keep sending snapshots.
      onSimulationFrame?.({ controlVector: [0, 0, 0] });
    };
    const down = (event) => {
      if (flightConfig?.inputBlocked || shouldIgnoreFlightKey(event) || !FLIGHT_KEYS.has(event.code)) return;
      keys.current[event.code] = true;
      onManualControl?.();
      event.preventDefault();
    };
    const up = (event) => { keys.current[event.code] = false; };
    const focus = (event) => { if (isInteractiveTarget(event.target)) clearInput(); };
    const visibility = () => { if (document.hidden) clearInput(); };
    const startLook = (event) => {
      if (flightConfig?.inputBlocked || !flightConfig?.mouseLook || event.button !== 0 || lookPointer) return;
      onManualControl?.();
      lookPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    };
    const look = (event) => {
      if (!lookPointer || lookPointer.id !== event.pointerId) return;
      const dx = event.clientX - lookPointer.x;
      const dy = event.clientY - lookPointer.y;
      lookPointer.x = event.clientX;
      lookPointer.y = event.clientY;
      yaw.current -= dx * .0022;
      pitch.current -= dy * .0018;
      const limit = Math.PI / 2.35;
      pitch.current = Math.max(-limit, Math.min(limit, pitch.current));
    };
    const endLook = (event) => { if (lookPointer?.id === event.pointerId) lookPointer = null; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clearInput);
    document.addEventListener('focusin', focus);
    document.addEventListener('visibilitychange', visibility);
    canvas.addEventListener('pointerdown', startLook);
    canvas.addEventListener('pointermove', look);
    canvas.addEventListener('pointerup', endLook);
    canvas.addEventListener('pointercancel', endLook);
    canvas.addEventListener('lostpointercapture', endLook);
    return () => {
      clearInput();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clearInput);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointerdown', startLook);
      canvas.removeEventListener('pointermove', look);
      canvas.removeEventListener('pointerup', endLook);
      canvas.removeEventListener('pointercancel', endLook);
      canvas.removeEventListener('lostpointercapture', endLook);
    };
  }, [flightConfig?.mouseLook, flightConfig?.inputBlocked, gl, onSimulationFrame, onManualControl]);

  useEffect(() => {
    keys.current = {};
    yaw.current = 0;
    pitch.current = -.08;
    roll.current = 0;
  }, [resetTick]);

  const quantumRef = useRef(createQuantumState(12));
  useEffect(() => {
    if (!navigationCommand?.destination || !groupRef.current) return;
    const direction = new THREE.Vector3(...navigationCommand.destination.position).sub(groupRef.current.position).normalize();
    yaw.current = Math.atan2(direction.x, direction.z);
    pitch.current = -Math.asin(Math.max(-1, Math.min(1, direction.y)));
    keys.current = {};
    cruiseTarget.current = getApproachPoint(groupRef.current.position.toArray(), navigationCommand.destination);
  }, [navigationCommand]);
  useEffect(() => {
    if (Math.abs(touchInput.x) + Math.abs(touchInput.y) + Math.abs(touchInput.z) > 0 || touchInput.boost) onManualControl?.();
  }, [touchInput, onManualControl]);

  const frameCounter = useRef(0);
  const correctionTargetRef = useRef(null);

  useEffect(() => {
    if (!correctionState?.position || !correctionState?.velocity) return;
    correctionTargetRef.current = {
      position: new THREE.Vector3(...correctionState.position),
      velocity: new THREE.Vector3(...correctionState.velocity),
      snap: correctionState.snap,
    };
  }, [correctionState]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    frameCounter.current += 1;
    const rawMove = new THREE.Vector3(
      (keys.current.KeyD || keys.current.ArrowRight ? 1 : 0) - (keys.current.KeyA || keys.current.ArrowLeft ? 1 : 0) + (touchInput.x || 0),
      (keys.current.Space || keys.current.KeyR ? 1 : 0) - (keys.current.ShiftLeft || keys.current.ShiftRight || keys.current.KeyF ? 1 : 0) + (touchInput.y || 0),
      (keys.current.KeyW || keys.current.ArrowUp ? 1 : 0) - (keys.current.KeyS || keys.current.ArrowDown ? 1 : 0) + (touchInput.z || 0),
    );
    if (flightConfig?.inputBlocked) rawMove.set(0, 0, 0);

    const boostActive = Boolean(keys.current.ControlLeft || keys.current.ControlRight || (touchInput.boost || 0) > 0.5);
    const fireActive = false;
    const thrustScale = (flightConfig?.thrustScale || 1) * (boostActive ? 1.75 : 1);
    const targetRoll = (keys.current.KeyA || keys.current.ArrowLeft ? 0.32 : 0) + (keys.current.KeyD || keys.current.ArrowRight ? -0.32 : 0);
    roll.current += (targetRoll - roll.current) * 0.08;
    const lookQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch.current, yaw.current, roll.current, 'YXZ'));
    const orientedMove = rawMove.clone();
    if (flightConfig?.sixAxis || flightConfig?.mouseLook) orientedMove.applyQuaternion(lookQuat);
    const dt = Math.max(1 / 240, Math.min(delta, 1 / 24));
    let controlVector = [orientedMove.x * thrustScale, orientedMove.y * thrustScale, orientedMove.z * thrustScale];
    const position = groupRef.current.position.toArray();
    if (!flightConfig?.inputBlocked && cruising && cruiseTarget.current) {
      controlVector = getCruiseControl({ position, velocity: velocity.current.toArray(), target: cruiseTarget.current, gravity: lastGravity.current });
      const direction = new THREE.Vector3(...navigationCommand.destination.position).sub(groupRef.current.position).normalize();
      yaw.current = Math.atan2(direction.x, direction.z);
      pitch.current = -Math.asin(Math.max(-1, Math.min(1, direction.y)));
      lookQuat.setFromEuler(new THREE.Euler(pitch.current, yaw.current, roll.current, 'YXZ'));
      if (distanceBetween(position, cruiseTarget.current) < .8 && velocity.current.length() < .7) onArrival?.(navigationCommand.destination);
    } else if (flightConfig?.inputBlocked || keys.current.KeyX || (flightConfig?.inertialDampers && rawMove.lengthSq() === 0)) {
      controlVector = getCruiseControl({ position, velocity: velocity.current.toArray(), target: position, gravity: lastGravity.current, braking: true });
    }
    const stepped = simRuntimeClient.stepSnapshot({
      mode: multiplayerMode ? 'multiplayer' : 'singleplayer',
      unifiedFlight: true,
      frameIndex: frameCounter.current,
      simulationSeed,
      position: [groupRef.current.position.x, groupRef.current.position.y, groupRef.current.position.z],
      velocity: [velocity.current.x, velocity.current.y, velocity.current.z],
      positionVector: groupRef.current.position.clone(),
      velocityVector: velocity.current.clone(),
      controlVector,
      inputVector: orientedMove.clone().multiplyScalar(thrustScale),
      dt,
      gravitySources: simulationGravitySources,
      isMobile,
    });

    velocity.current.set(...(stepped.velocity || [0, 0, 0]));
    groupRef.current.position.set(...(stepped.position || [0, 0, 18]));
    onSimulationFrame?.({
      frameIndex: frameCounter.current,
      controlVector: controlVector.map((v) => Number(v.toFixed(4))),
      dt: Number(dt.toFixed(5)),
      position: [Number(groupRef.current.position.x.toFixed(3)), Number(groupRef.current.position.y.toFixed(3)), Number(groupRef.current.position.z.toFixed(3))],
      velocity: [Number(velocity.current.x.toFixed(3)), Number(velocity.current.y.toFixed(3)), Number(velocity.current.z.toFixed(3))],
      simulationSeed,
      heartbeat: stepped.heartbeat,
      runtimeStatus: stepped.runtimeStatus,
      degradedReason: stepped.degradedReason,
    });

    if (correctionTargetRef.current) {
      const blend = correctionTargetRef.current.snap ? 1 : .45;
      groupRef.current.position.lerp(correctionTargetRef.current.position, blend);
      velocity.current.lerp(correctionTargetRef.current.velocity, blend);
      correctionTargetRef.current = null;
    }

    const speed = velocity.current.length();
    const direction = flightConfig?.mouseLook || speed <= 0.08 ? SHIP_MODEL_FORWARD.clone().applyQuaternion(lookQuat) : velocity.current.clone().normalize();
    const targetQuat = flightConfig?.mouseLook ? lookQuat : new THREE.Quaternion().setFromUnitVectors(SHIP_MODEL_FORWARD, direction);
    groupRef.current.quaternion.slerp(targetQuat, 0.1);

    const gravityMagnitude = Number(stepped.gravityMagnitude || 0);
    lastGravity.current = stepped.gravity || lastGravity.current;
    const nearestNode = explorationNodes.reduce((best, node) => {
      const distance = groupRef.current.position.distanceTo(new THREE.Vector3(...node.position));
      return !best || distance < best.distance ? { key: node.key, distance } : best;
    }, null);
    const nearest = nearestNode;
    const horizonFactor = nearest?.horizonFactor || 0;

    quantumRef.current = evolveQuantumState({
      prevState: quantumRef.current,
      dt,
      speed,
      gravityMagnitude,
      horizonFactor,
      authenticated,
      nearestKey: nearest?.key || null,
    });

    const flameScale = 0.72 + Math.min(speed * 0.06, 0.5) + (boostActive ? 0.34 : 0) + quantumRef.current.coherence * 0.1;
    [engineCoreRef, enginePortRef, engineStarboardRef].forEach((ref, index) => {
      if (!ref.current) return;
      const pulse = 0.9 + Math.sin(state.clock.elapsedTime * (20 + index * 3)) * 0.08;
      ref.current.scale.set(1, flameScale * pulse, 1);
    });


    const zoom = flightConfig?.chaseZoom || 1;
    const routeAssistLift = flightConfig?.routeAssist ? 0.9 : 0.25;
    const cameraOffset = SHIP_CAMERA_BACK.clone().multiplyScalar(10.4 * zoom + horizonFactor * 2.8);
    cameraOffset.y = 3.6 + routeAssistLift;
    if (flightConfig?.mouseLook || flightConfig?.sixAxis) cameraOffset.applyQuaternion(lookQuat);
    const cameraTarget = groupRef.current.position.clone().add(cameraOffset);
    camera.position.lerp(cameraTarget, 1 - Math.exp(-6 * Math.min(delta, .1)));
    const lookAhead = groupRef.current.position.clone().add(SHIP_MODEL_FORWARD.clone().multiplyScalar(5.5).applyQuaternion(lookQuat));
    camera.lookAt((flightConfig?.mouseLook || flightConfig?.sixAxis) ? lookAhead : groupRef.current.position.clone().add(new THREE.Vector3(0, 0.4, 1.1)));

    onTelemetryChange?.({
      speed: Number(speed.toFixed(2)),
      gravity: Number(gravityMagnitude.toFixed(2)),
      horizonFactor: Number(horizonFactor.toFixed(2)),
      nearest: nearest?.key || null,
      nearestDistance: Number((nearest?.distance || 0).toFixed(2)),
      escapeVelocity: Number((nearest?.escapeVelocity || 0).toFixed(2)),
      horizon: stepped.horizon,
      quantum: summarizeQuantumState(quantumRef.current),
      epoch: epochSummary,
      boosting: boostActive,
      firing: fireActive,
      frameIndex: frameCounter.current,
      tick: Date.now(),
      position: [
        Number(groupRef.current.position.x.toFixed(2)),
        Number(groupRef.current.position.y.toFixed(2)),
        Number(groupRef.current.position.z.toFixed(2)),
      ],
      velocity: [
        Number(velocity.current.x.toFixed(2)),
        Number(velocity.current.y.toFixed(2)),
        Number(velocity.current.z.toFixed(2)),
      ],
      direction: [
        Number(direction.x.toFixed(2)),
        Number(direction.y.toFixed(2)),
        Number(direction.z.toFixed(2)),
      ],
      controlVector: controlVector.map((v) => Number(v.toFixed(4))),
      dt: Number(dt.toFixed(5)),
      simulationSeed,
      runtime: {
        status: stepped.runtimeStatus || SIM_RUNTIME_STATUS.ONLINE,
        degradedReason: stepped.degradedReason || null,
      },
      continuityHeartbeat: stepped.heartbeat,
    });

    state.invalidate();
  });

  return (
    <group ref={groupRef} position={[0, 0, 18]}>
      <InterceptorHull />
      <pointLight position={[0, 1, 1]} color="#b8dcff" intensity={4} distance={7} />
      <mesh ref={engineCoreRef} position={[0, -.06, -2.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.12, 1.05, 16]} />
        <meshBasicMaterial color="#90e8ff" transparent opacity={0.92} depthWrite={false} />
      </mesh>
      <mesh ref={enginePortRef} position={[.69, .22, -2.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.09, 0.46, 16]} />
        <meshBasicMaterial color="#7fe7ff" transparent opacity={0.84} depthWrite={false} />
      </mesh>
      <mesh ref={engineStarboardRef} position={[-.69, .22, -2.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.09, 0.46, 16]} />
        <meshBasicMaterial color="#7fe7ff" transparent opacity={0.84} depthWrite={false} />
      </mesh>
    </group>
  );
}

function RemotePilot({ pilot, isSelf = false }) {
  const groupRef = useRef(null);

  useFrame((_, delta) => {
    if (!groupRef.current || !pilot?.position) return;
    const target = new THREE.Vector3(...pilot.position);
    groupRef.current.position.lerp(target, Math.min(1, delta * 4.5));
    const dir = new THREE.Vector3(...(pilot.direction || [0, 0, -1]));
    if (dir.lengthSq() > 0.001) {
      const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
      groupRef.current.quaternion.slerp(targetQuat, Math.min(1, delta * 3.2));
    }
  });

  return (
    <group ref={groupRef} position={pilot?.position || [0, 0, 0]}>
      <group scale={.55}><InterceptorHull /></group>
      <Html style={{ pointerEvents: 'none' }} zIndexRange={[30, 0]} position={[0, 0.68, 0]} center>
        <div className="pilot-tag anchored-label-panel small">
          <strong>{pilot?.displayName || 'Pilot'}</strong>
          <span>Explorer</span>
        </div>
      </Html>
    </group>
  );
}

function ProjectileSwarm({ projectiles = [] }) {
  return (
    <group>
      {projectiles.map((shot) => (
        <mesh key={shot.id} position={shot.position || [0, 0, 0]}>
          <sphereGeometry args={[0.1, 10, 10]} />
          <meshBasicMaterial color={shot.color || '#9fe8ff'} transparent opacity={0.9} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function StableSceneContent({ simRuntimeClient, graph, displayNodes, onSelect, selectedKey, onAutoFocus, onTelemetryChange, onCombatAction, touchInput, deviceTier, graphicsProfile, authenticated = false, flightConfig = null, remotePilots = [], projectiles = [], presentationMode = true, multiplayerMode = false, simulationSeed = 'tcentral-main', simulationGravitySources = [], onSimulationFrame = null, correctionState = null, resetTick = 0, sessionMode = SESSION_MODES.IDLE, ringAdjustments = null, navigationCommand, cruising, onManualControl, onArrival, destination }) {
  const epochSummary = useMemo(() => summarizeEpochRelativity(graph.epochAnchor), [graph]);
  const graphByKey = useMemo(() => Object.fromEntries(graph.nodes.map((node) => [node.key, node])), [graph]);
  const positions = useMemo(() => getNodePositionMap(graph), [graph]);
  const gravitySources = useMemo(
    () => createGravitySources(graph.nodes.filter((node) => ['blackhole', 'solar', 'dyson'].includes(node.kind))),
    [graph]
  );
  const csisState = graph.csisState || { linkedNodeKeys: [], quarantinedNodeKeys: [] };

  return (
    <>
      <fog attach="fog" args={['#07101b', 110, 360]} />
      <DeepSpaceScenery profile={graphicsProfile} />
      <DestinationBearing destination={destination} />
      <Stars radius={220} depth={120} count={graphicsProfile.stars} factor={3.2} saturation={.3} fade speed={graphicsProfile.animate ? .15 : 0} />
      <Sparkles count={deviceTier.isMobile ? 28 : 64} scale={[85, 50, 100]} size={1.2} speed={graphicsProfile.animate ? .12 : 0} opacity={.35} />
      {graphicsProfile.bloom ? <CinematicBloom /> : null}

      {graph.routeLinks.filter((link) => !presentationMode || link.from === selectedKey || link.to === selectedKey).map((link) => {
        const from = positions[link.from];
        const to = positions[link.to];
        if (!from || !to) return null;
        return (
          <RouteBeam
            key={link.key}
            from={from}
            to={to}
            color={link.color}
            arc={link.arc}
            opacity={link.faint ? 0.035 : 0.09}
            radius={link.faint ? 0.008 : 0.015}
          />
        );
      })}

      {displayNodes.map((node) => (
        <NodeVisual key={node.key} node={node} graphNode={graphByKey[node.key]} onSelect={onSelect} selectedKey={selectedKey} condensedLabels={presentationMode} animate={graphicsProfile.animate} sessionMode={sessionMode} ringAdjustments={ringAdjustments} />
      ))}

      <ProjectileSwarm projectiles={projectiles} />
      {remotePilots.map((pilot) => (
        <RemotePilot key={pilot.id} pilot={pilot} isSelf={Boolean(pilot.isSelf)} />
      ))}

      <FlightRig
        simRuntimeClient={simRuntimeClient}
        gravitySources={gravitySources}
        onNearestChange={onAutoFocus}
        onTelemetryChange={onTelemetryChange}
        onCombatAction={onCombatAction}
        touchInput={touchInput}
        isMobile={deviceTier.isMobile}
        authenticated={authenticated}
        epochSummary={epochSummary}
        flightConfig={flightConfig}
        multiplayerMode={multiplayerMode}
        simulationSeed={simulationSeed}
        simulationGravitySources={simulationGravitySources}
        onSimulationFrame={onSimulationFrame}
        correctionState={correctionState}
        resetTick={resetTick}
        navigationCommand={navigationCommand} cruising={cruising} onManualControl={onManualControl} onArrival={onArrival}
        explorationNodes={getExplorationDestinations(displayNodes)}
      />
    </>
  );
}


export default function StableSystemWorld({ lobbyMode = 'hub', steamUser = null, onSelectionChange = null, onModeChange }) {
  const deviceTier = useDeviceTier();
  const [graphicsQuality, setGraphicsQuality] = useState(() => {
    try { const saved = window.localStorage.getItem('tcentral_visual_quality'); return ['auto', 'high', 'performance'].includes(saved) ? saved : 'auto'; } catch { return 'auto'; }
  });
  useEffect(() => { try { window.localStorage.setItem('tcentral_visual_quality', graphicsQuality); } catch {} }, [graphicsQuality]);
  const graphicsProfile = useMemo(() => getGraphicsProfile(graphicsQuality, deviceTier), [graphicsQuality, deviceTier]);
  const { googleUser, refresh, universe } = useSteamSession();
  const identity = useMemo(() => resolveMultiplayerIdentity(steamUser, googleUser), [steamUser?.steamid, steamUser?.personaname, googleUser?.sub, googleUser?.name]);
  const [roomName, setRoomName] = useState(() => {
    const requested = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('room') : '';
    return isValidRoomName(requested) ? requested : process.env.NEXT_PUBLIC_MULTIPLAYER_ROOM || 'tcentral-main';
  });
  const [selected, setSelected] = useState(null);
  const [touchInput, setTouchInput] = useState({ x: 0, y: 0, z: 0, boost: 0 });
  const [flightConfig, setFlightConfig] = useState({ ...FLIGHT_PRESETS.freeFlight, inertialDampers: true });
  const [flightResetTick, setFlightResetTick] = useState(0);
  const [hudVisible, setHudVisible] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [prayerOpen, setPrayerOpen] = useState(false);
  const handlePrayerOpen = useCallback((open) => {
    setPrayerOpen(open);
    if (open) { setCruising(false); setTouchInput({ x: 0, y: 0, z: 0, boost: 0 }); }
  }, []);
  useEffect(() => { setPrayerOpen(false); }, [identity.id]);
  const [correctionState, setCorrectionState] = useState(null);
  const [navigationCommand, setNavigationCommand] = useState(null);
  const [cruising, setCruising] = useState(false);
  const [notice, setNotice] = useState('');
  const commandIndex = useRef(0);
  const lastTelemetryPublish = useRef(0);
  const [telemetry, setTelemetry] = useState({ speed: 0, gravity: 0, horizonFactor: 0, nearest: null, position: [0, 0, 18], velocity: [0, 0, 0], direction: [0, 0, 1], quantum: summarizeQuantumState(createQuantumState(12)) });
  const telemetryRef = useRef(telemetry);
  const predictionHistoryRef = useRef([]);
  const simRuntimeClient = useMemo(() => createSimulationRuntimeClient(), []);
  const { session: serverSession, authoritativeState, serverStatus } = useMultiplayerSession();

  const privateWorldAsset = useMemo(() => createPrivateWorldAsset({ steamUser, lobbyMode, identity }), [steamUser?.steamid, lobbyMode, identity]);
  const graph = useMemo(() => buildUniverseGraph(Date.now(), { lobbyMode, roomName, extraNodes: privateWorldAsset?.nodes || [], extraRouteLinks: privateWorldAsset?.routeLinks || [] }), [privateWorldAsset, lobbyMode, roomName]);
  const displayNodes = useMemo(() => graph.nodes.filter((node) => ['blackhole', 'dyson', 'solar', 'node'].includes(node.kind)), [graph]);
  const destinations = useMemo(() => getExplorationDestinations(displayNodes), [displayNodes]);
  const destination = selected || destinations.find((node) => node.key === 'halcyon');
  const simulationGravitySources = useMemo(() => buildGravitySourcesFromSeed(roomName), [roomName]);
  const cameraConfig = useMemo(() => ({ position: [0, 5, 4], fov: deviceTier.isMobile ? 58 : 52, near: .1, far: 1000 }), [deviceTier.isMobile]);
  const remotePilots = useMemo(() => (authoritativeState.players || []).filter((pilot) => pilot.id !== serverSession?.id), [authoritativeState.players, serverSession?.id]);

  const handleTelemetry = useCallback((next) => {
    telemetryRef.current = next;
    const now = performance.now();
    if (now - lastTelemetryPublish.current >= 100) {
      lastTelemetryPublish.current = now;
      setTelemetry(next);
    }
  }, []);
  const handleSimulationFrame = useCallback((frame) => {
    if (Number.isFinite(frame.frameIndex)) {
      predictionHistoryRef.current = [...predictionHistoryRef.current.slice(-119), { frameIndex: frame.frameIndex, dt: frame.dt, controlVector: frame.controlVector }];
    }
  }, []);

  useSharedFlight({ lobbyMode, roomName, identity, telemetryRef, inputsRef: predictionHistoryRef, simRuntimeClient, gravitySources: simulationGravitySources, onCorrection: setCorrectionState });

  const progressIdentityKey = identity.id + ':' + identity.kind + ':' + Boolean(identity.authenticated);
  const [progress, setProgress] = useState(defaultProgressState());
  const [progressHydrated, setProgressHydrated] = useState(false);
  const [hydratedProgressIdentityKey, setHydratedProgressIdentityKey] = useState(null);
  const [, setAccountProfile] = useState(null);

  const markVisited = useCallback((nodeKey) => {
    if (!nodeKey || nodeKey.startsWith('pilot:')) return;
    setProgress((current) => current.visitedNodes.includes(nodeKey) ? current : { ...current, visitedNodes: [...current.visitedNodes, nodeKey] });
  }, []);
  const handleSelect = (node) => {
    setSelected(node);
    setCruising(false);
    setNavigationCommand(null);
    setNotice('Waypoint set: ' + node.label);
    onSelectionChange?.(node);
  };
  const cancelCruise = useCallback(() => { setCruising(false); }, []);
  const arrive = useCallback((node) => {
    markVisited(node.key);
    setCruising(false);
    setNotice('Arrived at ' + node.label + '. Take the controls and explore.');
  }, [markVisited]);
  const navigate = (mode) => {
    if (!destination) return;
    setNavigationCommand({ id: ++commandIndex.current, destination, mode });
    setCruising(mode === 'cruise');
    setNotice(mode === 'cruise' ? 'Cruise engaged. Steer or drag space to take over.' : 'Facing ' + destination.label + '.');
  };

  useEffect(() => {
    setCruising(false);
    setNavigationCommand(null);
    const requested = new URLSearchParams(window.location.search).get('room');
    if (requested !== roomName && isValidRoomName(roomName)) {
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomName);
      window.history.replaceState(null, '', url);
    }
  }, [roomName, lobbyMode]);

  useEffect(() => {
    const handleHudToggle = (event) => setHudVisible(Boolean(event.detail));
    window.addEventListener('hudToggle', handleHudToggle);
    return () => window.removeEventListener('hudToggle', handleHudToggle);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 5500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!destination) return;
    const distance = distanceBetween(telemetry.position, destination.position);
    if (distance < (destination.approachRadius || 5) + 1) markVisited(destination.key);
  }, [destination, telemetry.position, markVisited]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let active = true;
    setProgressHydrated(false);
    setHydratedProgressIdentityKey(null);
    const storageKey = getAccountStorageKey(identity.id);

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const normalized = normalizeProgressState(parsed?.progress || parsed);
        setProgress(normalized);
        setAccountProfile(buildAccountSnapshot({ identity, steamUser, progress: normalized, savedAt: parsed?.savedAt }));
      }
    } catch {}

    const params = new URLSearchParams({
      id: identity.id,
      displayName: identity.displayName,
      kind: identity.kind,
      authenticated: String(Boolean(identity.authenticated)),
    });

    fetch(`/api/player/progression?${params.toString()}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (!active || !data?.snapshot) return;
        const normalized = normalizeProgressState(data.snapshot.progress);
        setProgress((current) => {
          const merged = normalizeProgressState({ ...normalized, ...current, visitedNodes: [...new Set([...(normalized.visitedNodes || []), ...(current.visitedNodes || [])])] });
          setAccountProfile(buildAccountSnapshot({ identity, steamUser, progress: merged, savedAt: data.snapshot.savedAt }));
          return merged;
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!active) return;
        setHydratedProgressIdentityKey(progressIdentityKey);
        setProgressHydrated(true);
      });

    return () => { active = false; };
  }, [identity.id, identity.displayName, identity.kind, identity.authenticated, progressIdentityKey, steamUser, googleUser]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!progressHydrated || hydratedProgressIdentityKey !== progressIdentityKey) return;
    const storageKey = getAccountStorageKey(identity.id);
    const snapshot = buildAccountSnapshot({ identity, steamUser, progress });
    setAccountProfile(snapshot);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
    } catch {}

    const controller = new AbortController();
    fetch('/api/player/progression', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, progress, savedAt: snapshot.savedAt }),
      signal: controller.signal,
    }).catch(() => {});

    return () => controller.abort();
  }, [progress, identity, progressHydrated, hydratedProgressIdentityKey, progressIdentityKey, steamUser, googleUser]);

  useEffect(() => {
    if (lobbyMode !== 'hub') return;
    if (progress.multiplayerJumped) return;
    if (!progress.visitedNodes.includes('solar_system')) return;
    setProgress((current) => ({ ...current, multiplayerJumped: true }));
  }, [lobbyMode, progress.multiplayerJumped, progress.visitedNodes]);



  return (
    <div className="stable-system-page polished-shell cinematic-system-page exploration-world">
      {hudVisible ? <div className="stable-system-hud" inert={prayerOpen ? '' : undefined}>
        <ExplorationHud telemetry={telemetry} destinations={destinations} destination={destination} onSelect={handleSelect}
          onNavigate={() => navigate('cruise')} onFace={() => navigate('face')} cruising={cruising} onCancelCruise={cancelCruise}
          visited={progress.visitedNodes} lobbyMode={lobbyMode} onModeChange={onModeChange} roomName={roomName} onRoomChange={setRoomName}
          pilots={authoritativeState.players || []} selfId={serverSession?.id} serverStatus={serverStatus}
          graphicsQuality={graphicsQuality} onGraphicsChange={setGraphicsQuality} dampers={flightConfig.inertialDampers}
          onDampersChange={() => setFlightConfig((current) => ({ ...current, inertialDampers: !current.inertialDampers }))}
          onRecenter={() => setFlightResetTick((tick) => tick + 1)} notice={notice} onPanelChange={setPanelOpen} seedCount={universe?.prayerSeeds?.total || 0} />
      </div> : <button type="button" className="stable-show-hud-button" onClick={() => gameEngine.setHUDVisible(true)}>Show HUD · H</button>}

      <div className="stable-world-canvas polished-canvas cinematic-polished-canvas sim-zone-center-canvas" aria-label="Explorable universe" inert={prayerOpen ? '' : undefined}>
        <Canvas camera={cameraConfig} dpr={graphicsProfile.dpr} gl={SIM_RENDERER_OPTIONS}>
          <PrayerSeedRelic telemetryRef={telemetryRef} animate={graphicsProfile.animate} />
          <StableSceneContent simRuntimeClient={simRuntimeClient} graph={graph} displayNodes={displayNodes} onSelect={handleSelect}
            selectedKey={destination?.key} onTelemetryChange={handleTelemetry} touchInput={touchInput} deviceTier={deviceTier}
            graphicsProfile={graphicsProfile} authenticated={Boolean(identity.authenticated)} flightConfig={{ ...flightConfig, inputBlocked: prayerOpen }} remotePilots={remotePilots}
            presentationMode multiplayerMode={lobbyMode === 'hub'} simulationSeed={roomName} simulationGravitySources={simulationGravitySources}
            resetTick={flightResetTick} onSimulationFrame={handleSimulationFrame} correctionState={correctionState}
            sessionMode={lobbyMode === 'hub' ? SESSION_MODES.MULTI_PLAYER : SESSION_MODES.SINGLE_PLAYER} ringAdjustments={authoritativeState.ringAdjustments}
            navigationCommand={navigationCommand} cruising={cruising} onManualControl={cancelCruise} onArrival={arrive} destination={destination} />
        </Canvas>
      </div>
      <PrayerSeedEncounter key={identity.id} telemetry={telemetry} authenticated={Boolean(identity.authenticated)} onOpenChange={handlePrayerOpen} onBound={refresh} enabled={hudVisible && !panelOpen} />
      {hudVisible && deviceTier.isMobile && !panelOpen && !prayerOpen ? <TouchFlightPad onInputChange={setTouchInput} /> : null}
    </div>
  );
}
