'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSteamSession } from '@/components/SteamSessionProvider';
import { WORLD_LAYOUT } from '@/lib/worldLayout';
import { getPrivateWorldKey } from '@/lib/securityConfig';
import { buildUniverseGraph, getNodePositionMap } from '@/lib/universeEngine';
import { createPrivateWorldAsset } from '@/lib/privateWorldAsset';
import { summarizeEpochRelativity } from '@/lib/epochDysonEngine';
import { createGravitySources, stepShipState } from '@/lib/physicsEngine';
import { buildGravitySourcesFromSeed, computePositionError, stepFrame } from '@/lib/simCore/stepFrame';
import { createQuantumState, summarizeQuantumState, evolveQuantumState } from '@/lib/quantumFieldEngine';
import { buildOperationsState } from '@/lib/missionFramework';
import { ENTROPIC_CURRENCY, computeEntropicIntegrity, resolveEntropicYield, summarizeEntropicEconomy } from '@/lib/entropicEngine';
import { resolveStarSingularity } from '@/lib/singularityEngine';
import { buildDynamicEngineState } from '@/lib/dynamicEngine';
import OperationsDirectorPanel from '@/components/OperationsDirectorPanel';
import EntropyMissionPanel from '@/components/EntropyMissionPanel';
import { useMultiplayerSession } from '@/components/MultiplayerSessionProvider';
import { subscribeToMultiplayerRoom } from '@/lib/multiplayerRealtimeClient';
import { resolveMultiplayerIdentity } from '@/lib/multiplayerSyncEngine';
import { buildAccountSnapshot, defaultProgressState, deriveProgression, getAccountStorageKey, normalizeProgressState } from '@/lib/accountProgression';
import AccountProgressPanel from '@/components/AccountProgressPanel';
import { HYPERSPACE_DIMENSION_COUNT, HYPERSPACE_SIGNATURE_PREFIX } from '@/lib/simulationConfig';
import { SESSION_MODES } from '@/lib/sessionModeEngine';
import { FLIGHT_CONTROL_COPY } from '@/lib/siteContent';

const UI_VISUAL_DEBUG = false;

function useDeviceTier() {
  const [tier, setTier] = useState({ isMobile: false, dpr: [1, 1.6], stars: 7600, sparkles: 220, meteors: 18 });

  useEffect(() => {
    const update = () => {
      const isMobile = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;
      setTier({
        isMobile,
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

function resolveClientSessionMode(lobbyMode, authoritativeMode) {
  if (authoritativeMode === SESSION_MODES.IDLE || authoritativeMode === SESSION_MODES.SINGLE_PLAYER || authoritativeMode === SESSION_MODES.MULTI_PLAYER) {
    return authoritativeMode;
  }
  return lobbyMode === 'hub' ? SESSION_MODES.MULTI_PLAYER : SESSION_MODES.SINGLE_PLAYER;
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
    beamRef.current.material.opacity = opacity + Math.sin(clock.elapsedTime * 1.4) * 0.04;
  });

  return (
    <mesh ref={beamRef}>
      <tubeGeometry args={[curve, 64, radius, 14, false]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}

function EventHorizon({ radius = 1.25, color = '#9fdcff' }) {
  const ringA = useRef(null);
  const ringB = useRef(null);
  const glow = useRef(null);
  const stringShellRef = useRef(null);
  const stringFilaments = useMemo(
    () => Array.from({ length: 14 }, (_, index) => ({
      key: `string-filament-${index}`,
      phase: (Math.PI * 2 * index) / 14,
      tilt: ((index % 7) - 3) * 0.12,
      radiusScale: 1.04 + (index % 4) * 0.06,
      arc: Math.PI * (0.45 + (index % 3) * 0.12),
      speed: 0.24 + (index % 5) * 0.05,
      opacity: 0.18 + (index % 4) * 0.05,
    })),
    []
  );

  useFrame(({ clock }, delta) => {
    if (ringA.current) ringA.current.rotation.z += delta * 0.85;
    if (ringB.current) ringB.current.rotation.z -= delta * 0.42;
    if (stringShellRef.current) stringShellRef.current.rotation.y += delta * 0.24;
    if (glow.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 2.1) * 0.08;
      glow.current.scale.setScalar(pulse);
    }

    stringShellRef.current?.children?.forEach((filament, index) => {
      const spec = stringFilaments[index];
      if (!filament || !spec) return;
      filament.rotation.y = spec.phase + clock.elapsedTime * spec.speed;
      filament.rotation.z = spec.tilt + Math.sin(clock.elapsedTime * (spec.speed + 0.08) + index) * 0.12;
    });
  });

  return (
    <group>
      <mesh ref={glow}>
        <sphereGeometry args={[radius * 1.8, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <mesh ref={ringA} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, radius * 0.26, 28, 160]} />
        <meshBasicMaterial color={color} transparent opacity={0.82} depthWrite={false} />
      </mesh>
      <mesh ref={ringB} rotation={[Math.PI / 2.35, Math.PI / 4, 0]}>
        <torusGeometry args={[radius * 1.34, radius * 0.06, 16, 120]} />
        <meshBasicMaterial color="#d7f7ff" transparent opacity={0.34} depthWrite={false} />
      </mesh>
      <group ref={stringShellRef}>
        {stringFilaments.map((filament) => (
          <mesh key={filament.key} rotation={[Math.PI / 2 + filament.tilt, filament.phase, 0]}>
            <torusGeometry args={[radius * filament.radiusScale, radius * 0.018, 10, 128, filament.arc]} />
            <meshBasicMaterial color="#effbff" transparent opacity={filament.opacity} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <Sparkles count={18} scale={radius * 3.1} size={2.4} speed={0.22} color="#f7fdff" opacity={0.5} />
    </group>
  );
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
        <Html center distanceFactor={16} position={[0, 2.6, 0]}>
          <div className="dyson-logic-tag">
            <strong>CSIS dual ring</strong>
            <span>Ring I: network linkage · Ring II: foundation firewall</span>
          </div>
        </Html>
      ) : null}
      {isSynaptics ? (
        <Html center distanceFactor={16} position={[0, 3.0, 0]}>
          <div className="dyson-logic-tag">
            <strong>Synaptics tri-ring</strong>
            <span>{dysonState.ringOneLabel || 'Collector ring'} · {dysonState.ringTwoLabel || 'Habitat ring'} · {dysonState.ringThreeLabel || 'Encryption ring'}</span>
          </div>
        </Html>
      ) : null}
    </group>
  );
}

function SolarSubSystem({ node }) {
  const orbitRefs = useRef([]);
  const starRef = useRef(null);
  const coronaRef = useRef(null);
  const stellarProfile = node.stellarProfile || {};
  const starColor = stellarProfile.color || node.color || '#ffd46b';
  const luminosity = stellarProfile.luminositySolar || 1;
  const radiusScale = 1 + Math.min((stellarProfile.radiusSolar || 1) * 0.12, 0.35);

  useFrame(({ clock }, delta) => {
    if (starRef.current) starRef.current.rotation.y += delta * (0.15 + (node.epochAnchor?.dysonAlignment || 0) * 0.08);
    if (coronaRef.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * (1.2 + luminosity * 0.05)) * 0.05;
      coronaRef.current.scale.setScalar(pulse * radiusScale);
    }
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
    <group position={node.position}>
      <mesh ref={coronaRef} scale={2.8 * radiusScale}>
        <sphereGeometry args={[1, 28, 28]} />
        <meshBasicMaterial color={starColor} transparent opacity={0.08 + Math.min(luminosity * 0.01, 0.06)} depthWrite={false} />
      </mesh>
      <mesh ref={starRef} scale={radiusScale}>
        <sphereGeometry args={[1.15, 32, 32]} />
        <meshStandardMaterial color={starColor} emissive={starColor} emissiveIntensity={0.72 + Math.min(luminosity * 0.03, 0.35)} roughness={0.38} metalness={0.12} />
      </mesh>
      {node.orbiters?.map((orbit, index) => (
        <group key={orbit.key}>
          <mesh rotation={[Math.PI / 2 + orbit.tilt, 0, 0]}>
            <torusGeometry args={[orbit.radius, 0.015, 8, 96]} />
            <meshBasicMaterial color={orbit.zone === 'habitable' ? '#b2ffd9' : '#dff8ff'} transparent opacity={orbit.zone === 'habitable' ? 0.22 : 0.14} depthWrite={false} />
          </mesh>
          <mesh ref={(el) => { orbitRefs.current[index] = el; }}>
            <sphereGeometry args={[orbit.size, 14, 14]} />
            <meshStandardMaterial color={orbit.color} emissive={orbit.color} emissiveIntensity={orbit.zone === 'habitable' ? 0.3 : 0.24} roughness={0.55} metalness={0.12} />
          </mesh>
        </group>
      ))}
      <Html center distanceFactor={18} position={[0, 2.8 * radiusScale, 0]}>
        <div className="dyson-logic-tag">
          <strong>{stellarProfile.spectralClass || 'G-class'} star</strong>
          <span>{stellarProfile.temperatureK || 5778} K · L {stellarProfile.luminositySolar || 1}☉ · HZ {stellarProfile.habitableInnerAu || 0.95}-{stellarProfile.habitableOuterAu || 1.67} AU</span>
        </div>
      </Html>
    </group>
  );
}

function NodeVisual({ node, onSelect, selectedKey, graphNode, condensedLabels = false, sessionMode = SESSION_MODES.IDLE, ringAdjustments = null }) {
  const isBlackhole = node.kind === 'blackhole';
  const isDyson = node.kind === 'dyson';
  const isSolar = node.kind === 'solar';
  const isMapAsset = Boolean(node.mapAsset && node.kind === 'node');
  const spinRef = useRef(null);
  const auraRef = useRef(null);
  const securityState = graphNode?.securityState || node.securityState || 'open';
  const quarantined = securityState === 'quarantined';

  useFrame(({ clock }, delta) => {
    if (spinRef.current) spinRef.current.rotation.y += delta * (isBlackhole ? 0.42 : isDyson ? 0.3 : 0.14);
    if (auraRef.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 1.8 + node.position[0]) * 0.08;
      auraRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={node.position || [0, 0, 0]}>
      <mesh ref={auraRef} scale={isBlackhole ? 2.25 : isDyson ? 1.8 : isSolar ? 2.8 : isMapAsset ? 1.7 : 0.95}>
        <sphereGeometry args={[1, 28, 28]} />
        <meshBasicMaterial color={quarantined ? '#8aa0b3' : node.color || '#9fdcff'} transparent opacity={quarantined ? 0.02 : isBlackhole ? 0.09 : isSolar ? 0.06 : 0.05} depthWrite={false} />
      </mesh>

      {isSolar ? <SolarSubSystem node={graphNode || node} /> : null}

      <group ref={spinRef} scale={quarantined ? 0.88 : 1}>
        {isBlackhole ? (
          <>
            <mesh onClick={() => onSelect(node)}>
              <sphereGeometry args={[0.46, 24, 24]} />
              <meshStandardMaterial color="#020409" emissive="#000000" roughness={0.32} metalness={0.2} />
            </mesh>
            <EventHorizon radius={1.08} color={node.color || '#9fdcff'} />
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

      {isBlackhole || isSolar || isMapAsset ? <GravityFieldRings position={[0, 0, 0]} color={node.color || '#9fdcff'} /> : null}
      {node.key === 'deep_blackhole' ? <MeteorSwarm count={12} radius={8.6} /> : null}

      {(!node.generated || isBlackhole) && (!condensedLabels || selectedKey === node.key || isBlackhole) ? (
        <Html center distanceFactor={14} position={[0, isSolar ? 2.25 : 1.65, 0]}>
          <button className={`stable-node-label polished ${selectedKey === node.key ? 'is-selected' : ''}`} onClick={() => onSelect(node)}>
            <strong>{node.label}</strong>
            <span>{node.privateOnly ? 'private asset' : node.kind}</span>
            <small>{node.address}</small>
          </button>
        </Html>
      ) : null}
    </group>
  );
}

function FlightRig({ gravitySources, onNearestChange, onTelemetryChange, onCombatAction, touchInput, isMobile = false, authenticated = false, epochSummary = null, flightConfig = null, multiplayerMode = false, simulationSeed = 'tcentral-main', simulationGravitySources = [], onSimulationFrame = null, correctionState = null }) {
  const groupRef = useRef(null);
  const hullGlowRef = useRef(null);
  const engineCoreRef = useRef(null);
  const enginePortRef = useRef(null);
  const engineStarboardRef = useRef(null);
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const keys = useRef({});
  const lastNearest = useRef(null);
  const { camera } = useThree();

  useEffect(() => {
    const down = (event) => { keys.current[event.code] = true; };
    const up = (event) => { keys.current[event.code] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const quantumRef = useRef(createQuantumState(12));
  const fireLatch = useRef(false);
  const frameCounter = useRef(0);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    frameCounter.current += 1;
    const rawMove = new THREE.Vector3(
      (keys.current.KeyD || keys.current.ArrowRight ? 1 : 0) - (keys.current.KeyA || keys.current.ArrowLeft ? 1 : 0) + (touchInput.x || 0),
      (keys.current.Space ? 1 : 0) - (keys.current.ShiftLeft || keys.current.ShiftRight ? 1 : 0) + (touchInput.y || 0),
      (keys.current.KeyS || keys.current.ArrowDown ? 1 : 0) - (keys.current.KeyW || keys.current.ArrowUp ? 1 : 0) + (touchInput.z || 0),
    );

    const boostActive = Boolean(keys.current.ControlLeft || keys.current.ControlRight || (touchInput.boost || 0) > 0.5);
    const fireActive = Boolean(keys.current.KeyQ || keys.current.KeyF);
    if (fireActive && !fireLatch.current) {
      fireLatch.current = true;
      onCombatAction?.({ type: 'fire', frameIndex: frameCounter.current, tick: Date.now() });
    } else if (!fireActive) {
      fireLatch.current = false;
    }
    const thrustScale = (flightConfig?.thrustScale || 1) * (boostActive ? 1.65 : 1);
    const dt = Math.min(delta, 1 / 24);
    const controlVector = [rawMove.x * thrustScale, rawMove.y * thrustScale, rawMove.z * thrustScale];
    const stepped = multiplayerMode
      ? stepFrame({
        position: [groupRef.current.position.x, groupRef.current.position.y, groupRef.current.position.z],
        velocity: [velocity.current.x, velocity.current.y, velocity.current.z],
        controlVector,
        dt,
        worldSeed: simulationSeed,
        gravitySources: simulationGravitySources,
        profile: 'multiplayer',
      })
      : stepShipState({
        position: groupRef.current.position.clone(),
        velocity: velocity.current.clone(),
        inputVector: rawMove.multiplyScalar(thrustScale),
        gravitySources,
        isMobile,
        dt,
      });

    if (multiplayerMode) {
      velocity.current.set(...stepped.velocity);
      groupRef.current.position.set(...stepped.position);
    } else {
      velocity.current.copy(stepped.velocity);
      groupRef.current.position.copy(stepped.position);
    }
    if (flightConfig?.inertialDampers !== false && rawMove.lengthSq() === 0) {
      velocity.current.lerp(new THREE.Vector3(0, 0, 0), 0.045);
    }
    frameRef.current += 1;
    onSimulationFrame?.({
      frameIndex: frameRef.current,
      controlVector: controlVector.map((v) => Number(v.toFixed(4))),
      dt: Number(dt.toFixed(5)),
      position: [Number(groupRef.current.position.x.toFixed(3)), Number(groupRef.current.position.y.toFixed(3)), Number(groupRef.current.position.z.toFixed(3))],
      velocity: [Number(velocity.current.x.toFixed(3)), Number(velocity.current.y.toFixed(3)), Number(velocity.current.z.toFixed(3))],
      simulationSeed,
    });

    if (correctionTargetRef.current) {
      groupRef.current.position.lerp(correctionTargetRef.current.position, 0.2);
      velocity.current.lerp(correctionTargetRef.current.velocity, 0.2);
      if (groupRef.current.position.distanceTo(correctionTargetRef.current.position) < 0.08) correctionTargetRef.current = null;
    }

    const speed = velocity.current.length();
    const direction = speed > 0.08 ? velocity.current.clone().normalize() : new THREE.Vector3(0, 0, -1);
    const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    groupRef.current.quaternion.slerp(targetQuat, 0.08);

    const gravityMagnitude = multiplayerMode
      ? new THREE.Vector3(...(stepped.gravity || [0, 0, 0])).length()
      : stepped.gravitySample.acceleration.length();
    const nearest = multiplayerMode ? null : (stepped.gravitySample.diagnostics[0] || null);
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
      ref.current.scale.set(1, 1, flameScale * pulse);
    });

    if (hullGlowRef.current) {
      const glowPulse = 0.96 + Math.sin(state.clock.elapsedTime * 2.4) * 0.06;
      hullGlowRef.current.scale.setScalar(glowPulse + quantumRef.current.coherence * 0.05);
      hullGlowRef.current.material.opacity = 0.12 + horizonFactor * 0.08;
    }

    const zoom = flightConfig?.chaseZoom || 1;
    const routeAssistLift = flightConfig?.routeAssist ? 0.9 : 0.25;
    const cameraOffset = new THREE.Vector3(0, 3.6 + routeAssistLift, 10.4 * zoom + horizonFactor * 2.8);
    const cameraTarget = groupRef.current.position.clone().add(cameraOffset);
    camera.position.lerp(cameraTarget, 0.06);
    camera.lookAt(groupRef.current.position.clone().add(new THREE.Vector3(0, 0.4, -1.1)));

    if (nearest && lastNearest.current !== nearest.key && nearest.distance < nearest.source.influenceRadius) {
      lastNearest.current = nearest.key;
      onNearestChange?.(nearest.key);
    }

    onTelemetryChange?.({
      speed: Number(speed.toFixed(2)),
      gravity: Number(gravityMagnitude.toFixed(2)),
      horizonFactor: Number(horizonFactor.toFixed(2)),
      nearest: nearest?.key || null,
      nearestDistance: Number((nearest?.distance || 0).toFixed(2)),
      escapeVelocity: Number((nearest?.escapeVelocity || 0).toFixed(2)),
      horizon: multiplayerMode ? null : stepped.horizon,
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
      frameIndex: frameRef.current,
      controlVector: controlVector.map((v) => Number(v.toFixed(4))),
      dt: Number(dt.toFixed(5)),
      simulationSeed,
    });

    state.invalidate();
  });

  return (
    <group ref={groupRef} position={[0, 0.2, 18]}>
      <mesh ref={hullGlowRef} scale={[1.85, 0.92, 2.45]}>
        <sphereGeometry args={[0.92, 24, 24]} />
        <meshBasicMaterial color="#7fe7ff" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.03, 0.28]} scale={[0.92, 0.62, 2.32]}>
        <capsuleGeometry args={[0.46, 1.9, 14, 22]} />
        <meshStandardMaterial color="#aecfff" emissive="#355a92" emissiveIntensity={0.24} roughness={0.2} metalness={0.82} />
      </mesh>
      <mesh position={[0, 0.22, 1.08]} scale={[0.44, 0.26, 1.1]} rotation={[0.12, 0, 0]}>
        <coneGeometry args={[0.52, 1.2, 24]} />
        <meshStandardMaterial color="#dcefff" emissive="#6fa5d8" emissiveIntensity={0.18} roughness={0.16} metalness={0.88} />
      </mesh>
      <mesh position={[0, 0.3, 0.72]} scale={[0.9, 0.42, 1.08]}>
        <sphereGeometry args={[0.34, 22, 22]} />
        <meshStandardMaterial color="#d8f8ff" emissive="#8fe4ff" emissiveIntensity={0.3} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, -0.02, -0.94]} scale={[0.72, 0.42, 1.35]}>
        <capsuleGeometry args={[0.34, 1.2, 12, 18]} />
        <meshStandardMaterial color="#6d809b" emissive="#1f3048" emissiveIntensity={0.14} roughness={0.34} metalness={0.76} />
      </mesh>
      <mesh position={[1.08, -0.02, -0.12]} rotation={[0.08, 0.16, -0.18]}>
        <boxGeometry args={[1.9, 0.08, 0.62]} />
        <meshStandardMaterial color="#a7c8ff" roughness={0.3} metalness={0.82} />
      </mesh>
      <mesh position={[-1.08, -0.02, -0.12]} rotation={[0.08, -0.16, 0.18]}>
        <boxGeometry args={[1.9, 0.08, 0.62]} />
        <meshStandardMaterial color="#a7c8ff" roughness={0.3} metalness={0.82} />
      </mesh>
      <mesh position={[1.52, 0.02, -0.44]} rotation={[0.1, 0.22, -0.34]}>
        <boxGeometry args={[0.82, 0.12, 0.32]} />
        <meshStandardMaterial color="#8fb2ef" roughness={0.34} metalness={0.78} />
      </mesh>
      <mesh position={[-1.52, 0.02, -0.44]} rotation={[0.1, -0.22, 0.34]}>
        <boxGeometry args={[0.82, 0.12, 0.32]} />
        <meshStandardMaterial color="#8fb2ef" roughness={0.34} metalness={0.78} />
      </mesh>
      <mesh position={[0, 0.62, -0.18]} rotation={[0.22, 0, 0]}>
        <boxGeometry args={[0.16, 0.78, 0.42]} />
        <meshStandardMaterial color="#7f96b3" roughness={0.4} metalness={0.7} />
      </mesh>
      <mesh position={[0, -0.22, -1.42]} scale={[0.82, 0.24, 0.98]}>
        <boxGeometry args={[0.92, 0.5, 0.88]} />
        <meshStandardMaterial color="#5c6f87" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[0.58, -0.16, -1.54]} rotation={[0, 0.06, 0]}>
        <capsuleGeometry args={[0.15, 0.62, 10, 14]} />
        <meshStandardMaterial color="#7288a5" roughness={0.24} metalness={0.84} />
      </mesh>
      <mesh position={[-0.58, -0.16, -1.54]} rotation={[0, -0.06, 0]}>
        <capsuleGeometry args={[0.15, 0.62, 10, 14]} />
        <meshStandardMaterial color="#7288a5" roughness={0.24} metalness={0.84} />
      </mesh>
      <mesh position={[0, -0.14, -1.9]}>
        <capsuleGeometry args={[0.2, 0.44, 10, 14]} />
        <meshStandardMaterial color="#6c7e96" roughness={0.26} metalness={0.82} />
      </mesh>
      <mesh ref={engineCoreRef} position={[0, -0.16, -2.34]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.18, 0.96, 20]} />
        <meshBasicMaterial color="#90e8ff" transparent opacity={0.92} depthWrite={false} />
      </mesh>
      <mesh ref={enginePortRef} position={[0.58, -0.16, -1.92]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.09, 0.46, 16]} />
        <meshBasicMaterial color="#7fe7ff" transparent opacity={0.84} depthWrite={false} />
      </mesh>
      <mesh ref={engineStarboardRef} position={[-0.58, -0.16, -1.92]} rotation={[Math.PI, 0, 0]}>
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
      <mesh scale={[1.35, 0.5, 1.9]}>
        <capsuleGeometry args={[0.22, 0.92, 10, 16]} />
        <meshStandardMaterial color={isSelf ? '#b8f6ff' : '#9fc2ff'} emissive={isSelf ? '#5fdfff' : '#486dd1'} emissiveIntensity={0.28} metalness={0.82} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0, -0.92]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.08, 0.38, 12]} />
        <meshBasicMaterial color={isSelf ? '#9ff7ff' : '#7fe7ff'} transparent opacity={0.72} depthWrite={false} />
      </mesh>
      <Html distanceFactor={12} position={[0, 0.68, 0]} center>
        <div className="pilot-tag anchored-label-panel small">
          <strong>{pilot?.displayName || 'Pilot'}</strong>
          <span>{Math.round(pilot?.health || 0)}% hull</span>
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

function StableSceneContent({ graph, displayNodes, onSelect, selectedKey, onAutoFocus, onTelemetryChange, onCombatAction, touchInput, deviceTier, authenticated = false, flightConfig = null, remotePilots = [], projectiles = [], presentationMode = true, multiplayerMode = false, simulationSeed = 'tcentral-main', simulationGravitySources = [], onSimulationFrame = null, correctionState = null, sessionMode = SESSION_MODES.IDLE, ringAdjustments = null }) {
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
      <color attach="background" args={['#030712']} />
      <fog attach="fog" args={['#07111d', 20, 105]} />
      <ambientLight intensity={1.0} />
      <directionalLight position={[8, 10, 6]} intensity={1.15} color="#dff8ff" />
      <pointLight position={[-10, 6, 10]} intensity={1.28} color="#9f7cff" />
      <pointLight position={[12, -2, 6]} intensity={1.12} color="#6dffb5" />
      <Stars radius={140} depth={72} count={presentationMode ? Math.round(deviceTier.stars * 0.58) : deviceTier.stars} factor={5.8} saturation={0} fade speed={1.1} />
      <Sparkles count={presentationMode ? Math.round(deviceTier.sparkles * 0.45) : deviceTier.sparkles} scale={[60, 34, 44]} size={3.0} speed={0.25} opacity={0.7} />
      <MeteorSwarm count={presentationMode ? Math.max(4, Math.round(deviceTier.meteors * 0.5)) : deviceTier.meteors} radius={26} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -14, 0]}>
        <circleGeometry args={[62, 72]} />
        <meshBasicMaterial color="#060d18" transparent opacity={0.56} />
      </mesh>

      <mesh position={[0, 12, -26]} scale={[2.6, 1.1, 1]}>
        <sphereGeometry args={[7.2, 40, 40]} />
        <meshBasicMaterial color="#132947" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <mesh position={[-18, 8, -18]} scale={[2.1, 1.0, 1]}>
        <sphereGeometry args={[5.8, 30, 30]} />
        <meshBasicMaterial color="#6b4dff" transparent opacity={0.12} depthWrite={false} />
      </mesh>

      {graph.routeLinks.map((link) => {
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
            opacity={link.faint ? 0.09 : 0.18}
            radius={link.faint ? 0.02 : 0.04}
          />
        );
      })}

      {displayNodes.map((node) => (
        <NodeVisual key={node.key} node={node} graphNode={graphByKey[node.key]} onSelect={onSelect} selectedKey={selectedKey} condensedLabels={presentationMode} sessionMode={sessionMode} ringAdjustments={ringAdjustments} />
      ))}

      <ProjectileSwarm projectiles={projectiles} />
      {remotePilots.map((pilot) => (
        <RemotePilot key={pilot.id} pilot={pilot} isSelf={Boolean(pilot.isSelf)} />
      ))}

      <FlightRig
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
      />
    </>
  );
}

function TouchFlightPad({ onInputChange }) {
  const setAxis = (axis, value) => onInputChange((prev) => ({ ...prev, [axis]: value }));

  return (
    <div className="touch-flight-pad" aria-hidden="true">
      <div className="touch-flight-cluster">
        <button onTouchStart={() => setAxis('z', -1)} onTouchEnd={() => setAxis('z', 0)} onMouseDown={() => setAxis('z', -1)} onMouseUp={() => setAxis('z', 0)}>↑</button>
        <div className="touch-flight-row">
          <button onTouchStart={() => setAxis('x', -1)} onTouchEnd={() => setAxis('x', 0)} onMouseDown={() => setAxis('x', -1)} onMouseUp={() => setAxis('x', 0)}>←</button>
          <button className="touch-flight-boost" onTouchStart={() => setAxis('boost', 1)} onTouchEnd={() => setAxis('boost', 0)} onMouseDown={() => setAxis('boost', 1)} onMouseUp={() => setAxis('boost', 0)}>Boost</button>
          <button onTouchStart={() => setAxis('x', 1)} onTouchEnd={() => setAxis('x', 0)} onMouseDown={() => setAxis('x', 1)} onMouseUp={() => setAxis('x', 0)}>→</button>
        </div>
        <button onTouchStart={() => setAxis('z', 1)} onTouchEnd={() => setAxis('z', 0)} onMouseDown={() => setAxis('z', 1)} onMouseUp={() => setAxis('z', 0)}>↓</button>
      </div>
      <div className="touch-flight-cluster vertical">
        <button onTouchStart={() => setAxis('y', 1)} onTouchEnd={() => setAxis('y', 0)} onMouseDown={() => setAxis('y', 1)} onMouseUp={() => setAxis('y', 0)}>Ascend</button>
        <button onTouchStart={() => setAxis('y', -1)} onTouchEnd={() => setAxis('y', 0)} onMouseDown={() => setAxis('y', -1)} onMouseUp={() => setAxis('y', 0)}>Descend</button>
      </div>
    </div>
  );
}

export default function StableSystemWorld({ lobbyMode = 'hub', steamUser = null, onSelectionChange = null }) {
  const router = useRouter();
  const deviceTier = useDeviceTier();
  const { universe, presence, updatePresence, refresh } = useSteamSession();
  const [selected, setSelected] = useState(null);
  const [touchInput, setTouchInput] = useState({ x: 0, y: 0, z: 0, boost: 0 });
  const [flightConfig, setFlightConfig] = useState({ thrustScale: 1, inertialDampers: true, chaseZoom: 1, routeAssist: true });
  const [flightDeckOpen, setFlightDeckOpen] = useState(true);
  const [presentationMode, setPresentationMode] = useState(true);
  const [correctionState, setCorrectionState] = useState(null);
  const lastPresenceBroadcast = useRef(0);
  const previousServerSessionRef = useRef(null);
  const activeSessionTokenRef = useRef(null);
  const [telemetry, setTelemetry] = useState({
    speed: 0,
    gravity: 0,
    horizonFactor: 0,
    nearest: null,
    nearestDistance: 0,
    escapeVelocity: 0,
    quantum: summarizeQuantumState(createQuantumState(12)),
    position: [0, 0, 18],
  });

  const [prayerSeedState, setPrayerSeedState] = useState({ status: '', ok: true });
  const [validatorSummary, setValidatorSummary] = useState(null);
  const identity = useMemo(() => resolveMultiplayerIdentity(steamUser), [steamUser]);
  const [progress, setProgress] = useState(defaultProgressState());
  const [accountProfile, setAccountProfile] = useState(() => buildAccountSnapshot({ identity: { id: 'boot', displayName: 'Boot Pilot', kind: 'guest', authenticated: false }, progress: defaultProgressState() }));
  const {
    session: serverSession,
    authoritativeState,
    serverStatus,
    setSession: setServerSession,
    setAuthoritativeState,
    setServerStatus,
    resetSessionState,
  } = useMultiplayerSession();

  const privateWorldAsset = useMemo(() => createPrivateWorldAsset({ steamUser, lobbyMode, identity }), [steamUser, lobbyMode, identity]);
  const graph = useMemo(() => buildUniverseGraph(Date.now(), { lobbyMode, roomName: process.env.NEXT_PUBLIC_MULTIPLAYER_ROOM || 'tcentral-main', extraNodes: privateWorldAsset?.nodes || [], extraRouteLinks: privateWorldAsset?.routeLinks || [] }), [privateWorldAsset, lobbyMode]);
  const epochSummary = useMemo(() => summarizeEpochRelativity(graph.epochAnchor), [graph]);
  const graphByKey = useMemo(() => Object.fromEntries(graph.nodes.map((node) => [node.key, node])), [graph]);
  const displayNodes = useMemo(() => graph.nodes.filter((node) => ['blackhole', 'dyson', 'solar', 'node'].includes(node.kind)), [graph]);

  const markVisited = (nodeKey) => {
    if (!nodeKey) return;
    setProgress((current) => ({
      ...current,
      visitedNodes: current.visitedNodes.includes(nodeKey) ? current.visitedNodes : [...current.visitedNodes, nodeKey],
    }));
  };

  const handleSelect = (node) => {
    setSelected(node);
    if (node?.key !== 'csis') markVisited(node?.key);
    onSelectionChange?.(node);
  };

  const handleAutoFocus = (key) => {
    const match = displayNodes.find((node) => node.key === key) || graphByKey[key] || null;
    if (!match) return;
    setSelected((current) => (current?.key === match.key ? current : match));
    markVisited(match?.key);
    onSelectionChange?.(match);
  };

  const activeNode = selected || displayNodes.find((node) => node.key === (privateWorldAsset?.blackholeKey || 'deep_blackhole')) || displayNodes.find((node) => node.key === 'deep_blackhole') || null;
  const entropicEconomy = useMemo(() => summarizeEntropicEconomy(progress), [progress]);

  const accountProgression = useMemo(() => deriveProgression(progress), [progress]);
  const showVisualDebugCards = UI_VISUAL_DEBUG && !presentationMode;

  const operations = useMemo(() => buildOperationsState({
    lobbyMode,
    steamUser,
    activeNode,
    telemetry,
    presence,
    universe,
    progress,
  }), [lobbyMode, steamUser, activeNode, telemetry, presence, universe, progress]);

  const handleRouteOpen = () => {
    if (!activeNode?.route) return;
    setProgress((current) => ({ ...current, routeTrips: current.routeTrips + 1 }));
    if (activeNode.external) {
      window.open(activeNode.route, '_blank', 'noopener,noreferrer');
    } else {
      router.push(activeNode.route);
    }
  };

  const highlightedTags = activeNode?.tags || ['blackhole', 'route shell', '3D anchor'];

  const remotePilots = useMemo(() => (authoritativeState.players || []).filter((pilot) => pilot.id !== serverSession?.id), [authoritativeState.players, serverSession?.id]);
  const projectiles = useMemo(() => authoritativeState.projectiles || [], [authoritativeState.projectiles]);
  const simulationSeed = authoritativeState?.simulation?.seed || serverSession?.room || (process.env.NEXT_PUBLIC_MULTIPLAYER_ROOM || 'tcentral-main');
  const simulationGravitySources = useMemo(() => buildGravitySourcesFromSeed(simulationSeed), [simulationSeed]);
  const sessionMode = resolveClientSessionMode(lobbyMode, authoritativeState?.mode);
  const ringAdjustments = authoritativeState?.ringAdjustments || { ringThreeSpinIntensity: 0, ringThreePulse: 0.12, intensity: 0 };

  const latestSimulationFrameRef = useRef({
    frameIndex: 0,
    controlVector: [0, 0, 0],
    dt: 1 / 60,
    simulationSeed: process.env.NEXT_PUBLIC_MULTIPLAYER_ROOM || 'tcentral-main',
  });
  const predictionHistoryRef = useRef([]);

  const handleCombatAction = useCallback(async (action) => {
    if (lobbyMode !== 'hub' || !serverSession?.token) return;
    try {
      const response = await fetch('/api/multiplayer/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: serverSession.room, id: serverSession.id, token: serverSession.token, mode: SESSION_MODES.MULTI_PLAYER, action }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.state) {
        setAuthoritativeState(data.state);
        setServerStatus({ connected: true, label: data?.state?.durable ? 'Durable sync' : 'Authoritative sync', tick: data.tick || 0 });
      }
    } catch {}
  }, [lobbyMode, serverSession]);

  const handleSimulationFrame = useCallback((frame) => {
    const normalizedFrame = {
      frameIndex: Number.isFinite(frame?.frameIndex) ? frame.frameIndex : latestSimulationFrameRef.current.frameIndex,
      controlVector: Array.isArray(frame?.controlVector) ? frame.controlVector : latestSimulationFrameRef.current.controlVector,
      dt: Number.isFinite(frame?.dt) ? frame.dt : latestSimulationFrameRef.current.dt,
      simulationSeed: frame?.simulationSeed || latestSimulationFrameRef.current.simulationSeed,
    };
    latestSimulationFrameRef.current = normalizedFrame;
    predictionHistoryRef.current = [...predictionHistoryRef.current.slice(-179), normalizedFrame];
  }, []);

  useEffect(() => {
    if (!telemetry?.quantum) return;
    const now = Date.now();
    if (now - lastPresenceBroadcast.current < 1200) return;
    lastPresenceBroadcast.current = now;
    updatePresence?.(telemetry);
  }, [telemetry, updatePresence]);

  useEffect(() => {
    let active = true;
    let cancelled = false;

    const connect = async () => {
      if (lobbyMode !== 'hub') return;
      if (serverSession?.token) return;

      try {
        const identity = resolveMultiplayerIdentity(steamUser);
        const response = await fetch('/api/multiplayer/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity, steamUser, roomName: process.env.NEXT_PUBLIC_MULTIPLAYER_ROOM || 'tcentral-main', mode: SESSION_MODES.MULTI_PLAYER }),
        });
        const data = await response.json().catch(() => null);
        if (!active || cancelled || !response.ok || !data?.ok) return;
        activeSessionTokenRef.current = data.token || null;
        setServerSession({ room: data.room, token: data.token, id: data.player?.id, displayName: data.player?.displayName });
        setServerStatus({ connected: true, label: data?.server?.durable ? 'Durable sync' : 'Authoritative sync', tick: data.server?.tick || 0 });
      } catch {
        if (!active || cancelled) return;
        setServerStatus({ connected: false, label: 'Server unavailable', tick: 0 });
      }
    };

    void connect();
    return () => {
      active = false;
      cancelled = true;
    };
  }, [lobbyMode, steamUser, setServerSession, setServerStatus]);

  useEffect(() => {
    const previousSession = previousServerSessionRef.current;
    const previousToken = previousSession?.token;
    const currentToken = serverSession?.token;

    if (previousToken && previousToken !== currentToken) {
      void disconnectMultiplayerSession(previousSession);
    }

    if (lobbyMode !== 'hub') {
      if (currentToken) {
        void disconnectMultiplayerSession(serverSession);
      }
      if (serverSession) {
        setServerSession(null);
      }
      activeSessionTokenRef.current = null;
      setAuthoritativeState({ authoritative: false, players: [], projectiles: [], world: { contestedNodes: [], combatHeat: 0, anomalyPhase: 0 }, playerCount: 0, mode: SESSION_MODES.SINGLE_PLAYER, modeTransition: { from: SESSION_MODES.MULTI_PLAYER, to: SESSION_MODES.SINGLE_PLAYER, changedAt: Date.now(), source: 'lobby' }, ringAdjustments: { ringThreeSpinIntensity: 0, ringThreePulse: 0.12, intensity: 0 } });
      setServerStatus({ connected: false, label: 'Private universe isolated', tick: 0 });
    } else if (currentToken) {
      activeSessionTokenRef.current = currentToken;
    }

    previousServerSessionRef.current = serverSession;
  }, [lobbyMode, serverSession, setAuthoritativeState, setServerSession, setServerStatus]);

  useEffect(() => {
    if (lobbyMode !== 'hub' || !serverSession?.token) return;
    let cancelled = false;
    let stopRealtime = () => {};
    const tick = async () => {
      try {
        const snapshot = {
          position: telemetry.position,
          velocity: telemetry.velocity,
          direction: telemetry.direction,
          nearest: telemetry.nearest,
          speed: telemetry.speed,
          frameIndex: telemetry.frameIndex,
          tick: telemetry.tick,
          quantumSignature: telemetry.quantum?.signature,
          firing: telemetry.firing,
          frameIndex: Number.isFinite(latestSimulationFrameRef.current?.frameIndex) ? latestSimulationFrameRef.current.frameIndex : 0,
          controlVector: Array.isArray(latestSimulationFrameRef.current?.controlVector) ? latestSimulationFrameRef.current.controlVector : [0, 0, 0],
          dt: Number.isFinite(latestSimulationFrameRef.current?.dt) ? latestSimulationFrameRef.current.dt : 1 / 60,
          simulationSeed: latestSimulationFrameRef.current?.simulationSeed || simulationSeed || process.env.NEXT_PUBLIC_MULTIPLAYER_ROOM || 'tcentral-main',
        };
        const response = await fetch('/api/multiplayer/state', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serverSession.token}`,
            'x-multiplayer-token': serverSession.token,
          },
          body: JSON.stringify({ roomName: serverSession.room, id: serverSession.id, token: serverSession.token, mode: SESSION_MODES.MULTI_PLAYER, snapshot }),
        });
        const data = await response.json().catch(() => null);
        if (cancelled) return;
        if (response.ok && data?.ok && data?.state) {
          setAuthoritativeState(data.state);
          setServerStatus({ connected: true, label: data?.state?.durable ? 'Durable sync' : 'Authoritative sync', tick: data.tick || 0 });
          const authoritativeSelf = (data?.state?.players || []).find((pilot) => pilot.id === serverSession.id);
          if (authoritativeSelf?.position && authoritativeSelf?.velocity) {
            const error = computePositionError(telemetry.position, authoritativeSelf.position);
            if (error > 1.2) {
              const replayInputs = predictionHistoryRef.current
                .filter((entry) => Number(entry.frameIndex) > Number(authoritativeSelf.frameIndex || 0))
                .slice(-48);
              const replayed = replayInputs.reduce((acc, frame) => stepFrame({
                position: acc.position,
                velocity: acc.velocity,
                controlVector: frame.controlVector,
                dt: frame.dt,
                worldSeed: simulationSeed,
                gravitySources: simulationGravitySources,
                profile: 'multiplayer',
              }), {
                position: authoritativeSelf.position,
                velocity: authoritativeSelf.velocity,
              });
              setCorrectionState({ position: replayed.position, velocity: replayed.velocity });
            } else {
              setCorrectionState({ position: authoritativeSelf.position, velocity: authoritativeSelf.velocity });
            }
            predictionHistoryRef.current = predictionHistoryRef.current
              .filter((entry) => Number(entry.frameIndex) > Number(authoritativeSelf.frameIndex || 0))
              .slice(-120);
          }
        } else if (response.status === 401) {
          setServerSession(null);
          setServerStatus({ connected: false, label: 'Rejoin required', tick: 0 });
        }
      } catch {
        if (!cancelled) setServerStatus((current) => ({ ...current, connected: false, label: 'Desynced' }));
      }
    };
    tick();
    stopRealtime = subscribeToMultiplayerRoom({ roomName: serverSession.room, onSignal: () => { void tick(); } });
    const id = window.setInterval(tick, serverStatus.label === 'Durable sync' ? 1500 : 300);
    return () => {
      cancelled = true;
      stopRealtime();
      window.clearInterval(id);
    };
  }, [lobbyMode, serverSession, telemetry, serverStatus.label, setAuthoritativeState, setServerSession, setServerStatus]);

  useEffect(() => {
    if (lobbyMode !== 'hub' || !serverSession?.room) {
      setValidatorSummary(null);
      return;
    }

    let cancelled = false;
    let intervalId = null;
    const refreshValidator = async () => {
      try {
        const params = new URLSearchParams({
          roomName: serverSession.room,
          strictMode: 'true',
          minCoverage: '0.9',
          limit: '300',
        });
        const response = await fetch(`/api/multiplayer/symmetry-validator?${params.toString()}`, { cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (cancelled || !response.ok || !data?.ok) return;
        setValidatorSummary({
          checked: data?.checked || 0,
          confidence: data?.report?.confidence || 'low',
          driftCount: data?.report?.summary?.driftCount || 0,
          gapCount: data?.report?.summary?.gapCount || 0,
          coverage: data?.report?.summary?.coverage || 0,
          strictCoverageFailed: Boolean(data?.report?.summary?.strictCoverageFailed),
        });
      } catch {}
    };

    void refreshValidator();
    intervalId = window.setInterval(() => { void refreshValidator(); }, 12000);
    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [lobbyMode, serverSession?.room]);


  useEffect(() => {
    const onUnload = () => {
      if (lobbyMode !== 'hub' || !serverSession?.token) return;
      void disconnectMultiplayerSession(serverSession);
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [lobbyMode, serverSession]);

  useEffect(() => () => {
    resetSessionState();
  }, [resetSessionState]);

  const handlePrayerSeed = async () => {
    const body = window.prompt('Plant a private Prayer Seed into the Solar System vault:', activeNode?.label ? `${activeNode.label} / ` : '');
    if (!body || !body.trim()) return;

    setPrayerSeedState({ status: 'Planting Prayer Seed...', ok: true });

    try {
      const response = await fetch('/api/universe/prayer-seeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, solarSystemKey: 'solar_system', tags: [activeNode?.key || 'deep_blackhole', lobbyMode], lobbyMode }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        setPrayerSeedState({
          status: data?.error || data?.message || 'Prayer Seed planting is unavailable right now.',
          ok: false,
        });
        return;
      }

      setPrayerSeedState({ status: data?.message || 'Prayer Seed planted.', ok: true });
      setProgress((current) => ({ ...current, seedCount: current.seedCount + 1 }));
      await refresh?.();
    } catch {
      setPrayerSeedState({ status: 'Prayer Seed request failed. Try again in a moment.', ok: false });
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let active = true;
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
      .catch(() => {});

    return () => { active = false; };
  }, [identity.id, identity.displayName, identity.kind, identity.authenticated, steamUser]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
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
      body: JSON.stringify({ identity, progress }),
      signal: controller.signal,
    }).catch(() => {});

    return () => controller.abort();
  }, [progress, identity, steamUser]);

  useEffect(() => {
    if (lobbyMode !== 'hub') return;
    if (progress.multiplayerJumped) return;
    if (!progress.visitedNodes.includes('solar_system')) return;
    setProgress((current) => ({ ...current, multiplayerJumped: true }));
  }, [lobbyMode, progress.multiplayerJumped, progress.visitedNodes]);

  const openMatrixRoute = () => {
    setProgress((current) => ({ ...current, routeTrips: current.routeTrips + 1, visitedNodes: current.visitedNodes.includes('matrixcoinexchange') ? current.visitedNodes : [...current.visitedNodes, 'matrixcoinexchange'] }));
    window.open('https://matrixcoinexchange.com', '_blank', 'noopener,noreferrer');
  };

  const singularityState = useMemo(() => resolveStarSingularity({
    gravity: telemetry.gravity,
    horizonFactor: telemetry.horizonFactor,
    coherencePercent: telemetry.quantum?.coherencePercent || 50,
    entropyPercent: telemetry.quantum?.entropyPercent || 50,
    spinPolarization: telemetry.quantum?.spinPolarization || 0,
    spinStabilityPercent: telemetry.quantum?.spinStabilityPercent || 50,
    spinHalfProjection: telemetry.quantum?.spinHalfProjection || 0,
    spinQuarterProjection: telemetry.quantum?.spinQuarterProjection || 0,
    speed: telemetry.speed,
    epochPhase: (telemetry.epoch?.phasePercent ?? epochSummary.phasePercent) / 100,
    nearestKey: telemetry.nearest || activeNode?.key || 'deep_blackhole',
  }), [telemetry, activeNode, epochSummary.phasePercent]);

  const dynamicState = useMemo(() => buildDynamicEngineState({ telemetry, flightConfig, operations, singularity: singularityState, entropic: entropicEconomy }), [telemetry, flightConfig, operations, singularityState, entropicEconomy]);

  const handleMineEntropy = () => {
    if (lobbyMode !== 'hub' || activeNode?.key !== 'entropic_node') return;
    const extractionBase = activeNode?.priority || 4;
    const quantumFactor = Number(telemetry?.quantum?.entropyPercent || 50) / 100;
    const singularityBonus = singularityState.resolvedWindow * 2.2;
    const extracted = Math.max(1, Math.round(extractionBase * 0.45 + quantumFactor * 3 + singularityBonus));
    setProgress((current) => ({
      ...current,
      entropyMined: current.entropyMined + extracted,
      visitedNodes: current.visitedNodes.includes('entropic_node') ? current.visitedNodes : [...current.visitedNodes, 'entropic_node'],
    }));
  };

  const handleResolveEntropy = () => {
    if (activeNode?.key !== 'matrixcoinexchange') return;
    const unresolved = Math.max(0, Number(progress.entropyMined || 0) - Number(progress.entropyResolved || 0));
    if (!unresolved) return;
    const routeIntegrity = computeEntropicIntegrity({
      coherence: Number(telemetry?.quantum?.coherencePercent || 50) / 100,
      horizonFactor: telemetry.horizonFactor,
      routeAssist: flightConfig.routeAssist,
      dampers: flightConfig.inertialDampers,
      boostActive: Boolean(telemetry.boosting),
    });
    const settlement = resolveEntropicYield({
      entropyUnits: unresolved,
      coherencePercent: telemetry?.quantum?.coherencePercent || 50,
      entropyPercent: telemetry?.quantum?.entropyPercent || 50,
      horizonFactor: telemetry.horizonFactor,
      routeIntegrity,
      singularityContainment: singularityState.containment,
      engineScale: 0.92 + dynamicState.dynamicBalance * 0.3,
    });
    setProgress((current) => ({
      ...current,
      entropyResolved: current.entropyResolved + unresolved,
      credits: Number((current.credits + settlement.quote).toFixed(2)),
      visitedNodes: current.visitedNodes.includes('matrixcoinexchange') ? current.visitedNodes : [...current.visitedNodes, 'matrixcoinexchange'],
    }));
    window.open('https://matrixcoinexchange.com', '_blank', 'noopener,noreferrer');
  };

  const perspective = steamUser?.steamid
    ? { role: lobbyMode === 'hub' ? 'Player-linked observer' : 'Private player layer', note: lobbyMode === 'hub' ? 'Steam session linked. Shared observance and pilot state remain synchronized.' : 'Private Steam world active with isolated route ownership and synchronized pilot state.' }
    : { role: 'Observer layer', note: 'Guest observer mode stays synchronized across the HUD and world while route flight remains available.' };

  const layerDefinitions = [
    {
      kicker: 'Layer 01',
      title: 'Cinematic background',
      detail: 'Animated universe canvas, starfields, route ribbons, and blackhole motion remain behind the interface shell.',
    },
    {
      kicker: 'Layer 02',
      title: 'Backdrop veil',
      detail: 'Gradient and cosmic image veil separate the playable scene from HUD glass so the background stays readable.',
    },
    {
      kicker: 'Layer 03',
      title: 'System cards',
      detail: 'Intro, route, observer, and telemetry cards stay pinned above the scene with stable click priority.',
    },
    {
      kicker: 'Layer 04',
      title: 'Live controls',
      detail: 'Steam controls, status strip, lobby mode, and the flight pad sit above all passive panels.',
    },
    {
      kicker: 'Layer 05',
      title: 'Pilot focus',
      detail: `Active node: ${activeNode?.label || 'Deep Space Blackhole'} · ${activeNode?.kind || 'blackhole'} route emphasis`,
    },
  ];

  return (
    <div className="stable-system-page polished-shell cinematic-system-page">
      <div className="stable-system-backdrop" />
      <div className="stable-system-veil" />

      <div className="stable-system-hud">
        <aside className="left-ops-rail">
          <OperationsDirectorPanel operations={operations} lobbyMode={lobbyMode} validationSummary={validatorSummary} />
          <AccountProgressPanel profile={{ ...accountProfile, progression: accountProgression, progress }} lobbyMode={lobbyMode} />
          <EntropyMissionPanel
            lobbyMode={lobbyMode}
            activeNode={activeNode}
            progress={progress}
            operations={operations}
            onMineEntropy={handleMineEntropy}
            onResolveEntropy={handleResolveEntropy}
            onOpenExchange={openMatrixRoute}
          />
        </aside>

        {UI_VISUAL_DEBUG ? <div className="content-card stable-card intro stable-card-layer primary-layer">
          <p className="eyebrow">Stability layer</p>
          <h3>{lobbyMode === 'hub' ? 'Shared Hub shell' : 'Private Universe shell'}</h3>
          <p className="muted">
            Built for focus view: fewer overlays, clearer object visibility, and direct access to full diagnostics when needed.
          </p>
          <div className="focus-meta">
            <span>{lobbyMode === 'hub' ? 'Shared route layer · discrepant hub star online' : privateWorldAsset?.privateScope || getPrivateWorldKey(steamUser?.steamid)}</span>
            <span>{steamUser?.personaname || identity.displayName || 'Guest'}</span>
          </div>
          <div className="stable-chip-row">
            <span>Gravity flight</span>
            <span>{steamUser?.steamid ? 'Steam-linked shell' : 'Guest shell sync'}</span>
            <span>{`${HYPERSPACE_SIGNATURE_PREFIX} state-space`}</span>
            <span>{universe?.privacy?.privacyTier || 'guest-public'}</span>
            <span>{lobbyMode === 'hub' ? 'Hub star sync' : `${privateWorldAsset?.replicaSystems?.length || 1}x epoch-rolling private systems`}</span>
            <span>Epoch {(privateWorldAsset?.epochWindow ?? epochSummary.unix)}</span>
            <span>Ops {operations.completionPercent}%</span>
          </div>
          <div className="stable-chip-row alt">
            <button className={`stable-route-button compact ${presentationMode ? 'is-live' : ''}`} onClick={() => setPresentationMode((current) => !current)}>
              {presentationMode ? 'Presentation mode on' : 'Presentation mode off'}
            </button>
            <span>{presentationMode ? 'Condensed HUD + cleaner scene' : 'Full HUD + full telemetry cards'}</span>
          </div>
        </div> : null}

        {UI_VISUAL_DEBUG ? <div className="content-card stable-card focus stable-card-layer route-layer">
          <p className="eyebrow">Route focus</p>
          <h3>{activeNode?.label || 'Deep Space Blackhole'}</h3>
          <p className="muted">{activeNode?.description || 'Primary anchor route.'}</p>
          <div className="focus-meta">
            <span>{activeNode?.address || 'Primary anchor'}</span>
            <span>{activeNode?.kind || 'blackhole'}</span>
          </div>
          <div className="stable-chip-row alt">
            {highlightedTags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <div className="stable-chip-row alt">
            <span>Epoch {privateWorldAsset?.unixEpoch ?? epochSummary.unix}</span>
            <span>Dyson {epochSummary.dysonPercent}%</span>
            <span>Phase {epochSummary.phasePercent}%</span>
          </div>
          {activeNode?.route ? (
            <button className="stable-route-button" onClick={handleRouteOpen}>
              Travel to route
            </button>
          ) : null}
          {activeNode?.key === 'entropic_node' ? <p className="stable-flight-note">Mine this seam only after switching to the multiplayer hub.</p> : null}
          {activeNode?.key === 'matrixcoinexchange' ? <p className="stable-flight-note">Return here with unresolved entropy to settle the cargo into {ENTROPIC_CURRENCY.shortLabel}.</p> : null}
          {activeNode?.key === 'ss_dock' ? <p className="stable-flight-note">Dock here in proximity to the Synaptics.Systems Dyson Sphere before and after long-range sorties.</p> : null}
          {activeNode?.key === 'csis' ? <p className="stable-flight-note">CSIS ring I drives conscious intelligence and cyberfield production, ring II handles ingress/egress routes, and ring III performs encryption/firewall monitoring over rings I + II + III. Spin integers 1/2, 1/4, and 3/4 stay active at an astrological quantum tier with bidirectional API links. This sphere is sealed to players and remains a system-owned defense anchor. Linked anchors: {graph.csisState?.linkedNodeKeys?.length || 0} · quarantined relays: {graph.csisState?.quarantinedNodeKeys?.length || 0}.</p> : null}
        </div> : null}

        {showVisualDebugCards && privateWorldAsset ? (
          <div className="content-card stable-card observer stable-card-layer observer-layer">
            <p className="eyebrow">Private map asset</p>
            <h3>{privateWorldAsset.label}</h3>
            <p className="muted">Singleplayer fabric stays private to each account world while multiplayer remains shared for flight and combat. The nested blackhole and the four server-linked private blackholes stay inside the map mesh, and the independent Central.Star replica systems roll with Unix epoch timing.</p>
            <div className="focus-meta">
              <span>{privateWorldAsset.privateScope}</span>
              <span>Anchor {privateWorldAsset.anchorToken}</span>
            </div>
            <div className="stable-chip-row alt">
              <span>Steam-linked private mesh</span>
              <span>Epoch {privateWorldAsset.unixEpoch}</span>
              <span>Window {privateWorldAsset.epochWindow}</span>
              <span>Nested blackhole core</span>
              <span>{privateWorldAsset.serverBlackholeKeys?.length || 0} server blackholes</span>
            </div>
          </div>
        ) : null}

        <div className="content-card stable-card observer stable-card-layer observer-layer">
          <p className="eyebrow">Observer / Pilot</p>
          <h3>{perspective.role}</h3>
          <p className="muted">{perspective.note}</p>
          <div className="focus-meta">
            <span>{steamUser?.personaname || 'Guest observer'}</span>
            <span>{lobbyMode === 'hub' ? 'Shared world visibility' : 'Private world visibility'}</span>
          </div>
          <div className="stable-chip-row alt">
            <span>Inspect</span>
            <span>Fly</span>
            <span>Overlay-safe</span>
            <span>{authoritativeState.playerCount || presence.length} pilots</span>
          </div>
          <p className="stable-flight-note">
            Desktop: {FLIGHT_CONTROL_COPY.desktopSummary} + {FLIGHT_CONTROL_COPY.verticalSummary}. Mobile: use the {FLIGHT_CONTROL_COPY.touchSummary}.
          </p>
          {lobbyMode === 'private' ? (
            <button className="stable-route-button" onClick={handlePrayerSeed}>
              Plant Prayer Seed
            </button>
          ) : null}
          {prayerSeedState.status ? (
            <p className={`report-status ${prayerSeedState.ok ? 'success' : 'error'}`}>{prayerSeedState.status}</p>
          ) : null}
        </div>


        {showVisualDebugCards ? <div className="content-card stable-card observer quantum-telemetry-card stable-card-layer telemetry-layer">
          <p className="eyebrow">Private universe matrix</p>
          <h3>{universe?.privacy?.observanceScope || 'hub:public'}</h3>
          <p className="muted">Prayer Seeds stay bound to the private universe vault while the Solar System remains anchored to Unix epoch timing and Dyson-sphere relativity.</p>
          <div className="focus-meta">
            <span>{universe?.privacy?.storageKey || 'vault:guest'}</span>
            <span>{universe?.privacy?.multiplayerChannel || 'mp:public'}</span>
          </div>
          <div className="stable-chip-row alt">
            <span>{universe?.privacy?.privacyTier || 'guest-public'}</span>
            <span>Seeds {universe?.prayerSeeds?.total ?? 0}</span>
            <span>Pilots {authoritativeState.playerCount || presence.length}</span>
          </div>
        </div> : null}


        {showVisualDebugCards ? <div className="content-card stable-card observer quantum-telemetry-card stable-card-layer telemetry-layer">
          <p className="eyebrow">CSIS lattice / firewall state</p>
          <h3>{(graph.csisState?.ringOneLabel || 'Conscious intelligence / cyberfield production')} + {(graph.csisState?.ringTwoLabel || 'Ingress / egress')} + {(graph.csisState?.ringThreeLabel || 'Encryption / firewall monitoring')}</h3>
          <p className="muted">The CSIS tri-ring lattice maps to ring I conscious intelligence + cyberfield production, ring II ingress/egress flow, and ring III encryption/firewall monitoring across all three rings. Spin integers {graph.csisState?.spinProfile?.join(' · ') || '1/2 · 1/4 · 3/4'} run in an astrological quantum tier with bidirectional API exchange while non-foundation relays stay quarantined inside game space.</p>
          <div className="focus-meta">
            <span>Linked anchors {graph.csisState?.linkedNodeKeys?.length || 0}</span>
            <span>Quarantined relays {graph.csisState?.quarantinedNodeKeys?.length || 0}</span>
          </div>
          <div className="stable-chip-row alt">
            <span>Pulse {Math.round((graph.csisState?.linkagePulse || 0) * 100)}%</span>
            <span>Sweep {Math.round((((graph.csisState?.firewallSweep || 0) / (Math.PI * 2)) % 1) * 100)}%</span>
            <span>API flow {graph.csisState?.apiFlow || 'bidirectional'}</span>
            <span>Player access {graph.csisState?.playerAccess || 'sealed'}</span>
          </div>
        </div> : null}


        {showVisualDebugCards ? <div className="content-card stable-card observer quantum-telemetry-card stable-card-layer telemetry-layer">
          <p className="eyebrow">Engine stack / singularity equation</p>
          <h3>{singularityState.stateLabel}</h3>
          <p className="muted">The multiplayer realm now resolves a stellar singularity window before entropy is stabilized. The engine stack blends mathematical, physical, entropic, quantum, singularity, and dynamic states into one route outcome.</p>
          <div className="focus-meta">
            <span>{singularityState.equation}</span>
            <span>{ENTROPIC_CURRENCY.symbol} = ΔE × C × S × (1 - H) × R</span>
          </div>
          <div className="stable-chip-row alt">
            <span>Containment {Math.round(singularityState.containment * 100)}%</span>
            <span>Window {Math.round(singularityState.resolvedWindow * 100)}%</span>
            <span>Engine load {Math.round(dynamicState.engineLoad * 100)}%</span>
          </div>
          <div className="stable-chip-row alt">
            <span>Route stability {Math.round(dynamicState.routeStability * 100)}%</span>
            <span>Mission pressure {Math.round(dynamicState.missionPressure * 100)}%</span>
            <span>Dynamic balance {Math.round(dynamicState.dynamicBalance * 100)}%</span>
          </div>
          <p className="stable-flight-note">Resolved scalar balance: {entropicEconomy.scalarCredits.toFixed(2)} {ENTROPIC_CURRENCY.shortLabel} · unresolved cargo {entropicEconomy.unresolved}</p>
        </div> : null}

        {showVisualDebugCards ? <div className="content-card stable-card observer quantum-telemetry-card stable-card-layer telemetry-layer">
          <p className="eyebrow">{`${HYPERSPACE_SIGNATURE_PREFIX} / Physics telemetry`}</p>
          <h3>{telemetry.quantum.signature}</h3>
          <p className="muted">{`Mathematical flight now resolves a live singularity window using RK4 integration, inverse-square gravity, event-horizon stress, entropic containment, and a ${HYPERSPACE_DIMENSION_COUNT}-dimensional state-space that reacts to your motion and the nearest anchor.`}</p>
          <div className="focus-meta">
            <span>Speed {telemetry.speed}</span>
            <span>Gravity {telemetry.gravity}</span>
          </div>
          <div className="stable-chip-row alt">
            <span>Coherence {telemetry.quantum.coherencePercent}%</span>
            <span>Entropy {telemetry.quantum.entropyPercent}%</span>
            <span>{telemetry.quantum.dominantDimension}</span>
          </div>
          <p className="stable-flight-note">
            Nearest anchor: {telemetry.nearest || 'deep-space drift'} · Δr {telemetry.nearestDistance} · vₑ {telemetry.escapeVelocity}
          </p>
          <div className="stable-chip-row alt">
            <span>Epoch {telemetry.epoch?.unix ?? epochSummary.unix}</span>
            <span>Dyson {telemetry.epoch?.dysonPercent ?? epochSummary.dysonPercent}%</span>
            <span>Seeds {universe?.prayerSeeds?.total ?? 0}</span>
          </div>
        </div> : null}
      </div>


      {showVisualDebugCards ? <div className="content-card stable-card observer quantum-telemetry-card stable-card-layer telemetry-layer">
        <p className="eyebrow">Authoritative multiplayer state</p>
        <h3>{serverStatus.label}</h3>
        <p className="muted">The multiplayer hub now maintains server-side player transforms, projectile state, contested nodes, and combat heat so the shared multiverse is more than just presence sync.</p>
        <div className="focus-meta">
          <span>Room {serverSession?.room || (process.env.NEXT_PUBLIC_MULTIPLAYER_ROOM || 'tcentral-main')}</span>
          <span>Tick {serverStatus.tick}</span>
        </div>
        <div className="stable-chip-row alt">
          <span>Pilots {authoritativeState.playerCount || 0}</span>
          <span>Projectiles {projectiles.length}</span>
          <span>Combat heat {authoritativeState.world?.combatHeat || 0}%</span>
        </div>
        <div className="stable-chip-row alt">
          <span>Contested {(authoritativeState.world?.contestedNodes || []).map((node) => node.key).join(' · ') || 'none'}</span>
          <span>Anomaly {Math.round((authoritativeState.world?.anomalyPhase || 0) * 100)}%</span>
        </div>
      </div> : null}

      <div className="content-card stable-card observer flight-command-card stable-card-layer telemetry-layer">
        <button
          type="button"
          className="panel-minimize-toggle"
          onClick={() => setFlightDeckOpen((value) => !value)}
          aria-expanded={flightDeckOpen}
          aria-label={flightDeckOpen ? 'Minimize flight command deck panel' : 'Expand flight command deck panel'}
        >
          <div>
            <p className="eyebrow">Flight command deck</p>
            <h3>Flight-command deck interface</h3>
          </div>
          <span className="panel-minimize-indicator" aria-hidden="true">{flightDeckOpen ? '−' : '+'}</span>
        </button>
        {flightDeckOpen ? (
          <>
            <p className="muted">
              Route-flight now runs through a clearer command layout with grouped controls, live readability, and quicker crew-side tuning for multiplayer and private missions.
            </p>
            <div className="flight-command-stat-grid">
              <article>
                <small>Current speed</small>
                <strong>{telemetry.speed}</strong>
              </article>
              <article>
                <small>Nearest anchor</small>
                <strong>{telemetry.nearest || 'deep-space drift'}</strong>
              </article>
              <article>
                <small>Position vector</small>
                <strong>{telemetry.position.map((value) => value.toFixed ? value.toFixed(1) : value).join(' / ')}</strong>
              </article>
            </div>
            <div className="stable-chip-row alt">
              <span>Math engine live</span>
              <span>Physics engine live</span>
              <span>Entropic engine live</span>
              <span>Quantum engine live</span>
              <span>Singularity engine live</span>
              <span>Dynamic engine live</span>
            </div>
            <div className="stable-chip-row alt flight-command-toggle-row">
              <button className={`stable-route-button compact ${flightConfig.inertialDampers ? 'is-live' : ''}`} onClick={() => setFlightConfig((current) => ({ ...current, inertialDampers: !current.inertialDampers }))}>
                {flightConfig.inertialDampers ? 'Dampers online' : 'Dampers offline'}
              </button>
              <button className={`stable-route-button compact ${flightConfig.routeAssist ? 'is-live' : ''}`} onClick={() => setFlightConfig((current) => ({ ...current, routeAssist: !current.routeAssist }))}>
                {flightConfig.routeAssist ? 'Route assist on' : 'Route assist off'}
              </button>
            </div>
            <div className="flight-slider-grid">
              <label>
                <span>Thrust bias</span>
                <input type="range" min="0.65" max="1.8" step="0.05" value={flightConfig.thrustScale} onChange={(event) => setFlightConfig((current) => ({ ...current, thrustScale: Number(event.target.value) }))} />
              </label>
              <label>
                <span>Chase zoom</span>
                <input type="range" min="0.8" max="1.4" step="0.05" value={flightConfig.chaseZoom} onChange={(event) => setFlightConfig((current) => ({ ...current, chaseZoom: Number(event.target.value) }))} />
              </label>
            </div>
            <p className="stable-flight-note">
              {FLIGHT_CONTROL_COPY.fullSummary}
            </p>
            <div className="stable-chip-row alt">
              <button className="stable-route-button compact" onClick={() => handleCombatAction({ type: 'fire' })} disabled={lobbyMode !== 'hub' || !serverSession?.token}>
                Fire pulse
              </button>
              <span>{lobbyMode === 'hub' ? 'Shared combat lane' : 'Combat disabled in private world'}</span>
            </div>
          </>
        ) : null}
      </div>

      <div className="stable-world-canvas polished-canvas cinematic-polished-canvas">
        <Canvas camera={{ position: [0, 8, 26], fov: deviceTier.isMobile ? 52 : (presentationMode ? 49 : 46) }} dpr={deviceTier.dpr} gl={{ antialias: !deviceTier.isMobile }}>
          <StableSceneContent
            graph={graph}
            displayNodes={displayNodes}
            onSelect={handleSelect}
            selectedKey={activeNode?.key}
            onAutoFocus={handleAutoFocus}
            touchInput={touchInput}
            deviceTier={deviceTier}
            authenticated={Boolean(steamUser?.steamid)}
            onTelemetryChange={setTelemetry}
            onCombatAction={handleCombatAction}
            flightConfig={flightConfig}
            remotePilots={remotePilots}
            projectiles={projectiles}
            presentationMode={presentationMode}
            multiplayerMode={lobbyMode === 'hub'}
            simulationSeed={simulationSeed}
            simulationGravitySources={simulationGravitySources}
            onSimulationFrame={handleSimulationFrame}
            correctionState={correctionState}
            sessionMode={sessionMode}
            ringAdjustments={ringAdjustments}
          />
        </Canvas>
      </div>

      {showVisualDebugCards ? <div className="stable-layer-dock">
        <div className="stable-layer-dock-head">
          <strong>System object layering</strong>
          <span className="eyebrow">Defined render stack</span>
        </div>
        <div className="stable-layer-grid">
          {layerDefinitions.map((item) => (
            <article className="stable-layer-pill" key={item.title}>
              <span>{item.kicker}</span>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
      </div> : null}

      {deviceTier.isMobile ? <TouchFlightPad onInputChange={setTouchInput} /> : null}
    </div>
  );
}
