'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, Stars, Trail, Line } from '@react-three/drei';
import * as THREE from 'three';
import { SERVER_CATALOG } from '@/lib/serverCatalog';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { WORLD_LAYOUT as NODES } from '@/lib/worldLayout';
import { SYSTEM_RUNTIME, isMobileViewport, shouldReduceScene } from '@/lib/systemRuntime';
import { getPrivateWorldKey } from '@/lib/securityConfig';
import { DEFAULT_FLIGHT_STATS, normalizeFlightStats, getSafePosition } from '@/lib/playerRuntime';
import ServerRoutePanel from '@/components/ServerRoutePanel';
import RoomObjectives from '@/components/RoomObjectives';

function formatStatus(status) {
  if (!status) return 'Status unavailable';
  if (status.online === true) return `${status.players ?? 0} / ${status.maxPlayers ?? '?'}`;
  if (status.online === false) return 'Offline';
  return 'Status unavailable';
}


function DynamicBackgroundField() {
  const group = useRef(null);
  const nebulaA = useRef(null);
  const nebulaB = useRef(null);
  const nebulaC = useRef(null);
  const nebulaD = useRef(null);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.0035;
    if (nebulaA.current) nebulaA.current.rotation.z += delta * 0.006;
    if (nebulaB.current) nebulaB.current.rotation.z -= delta * 0.004;
    if (nebulaC.current) nebulaC.current.rotation.y += delta * 0.004;
    if (nebulaD.current) nebulaD.current.rotation.x -= delta * 0.003;
  });

  return (
    <group ref={group}>
      <mesh ref={nebulaA} position={[-28, 16, -34]}>
        <sphereGeometry args={[16, 48, 48]} />
        <meshBasicMaterial color="#5d3ff1" transparent opacity={0.12} />
      </mesh>
      <mesh ref={nebulaB} position={[24, -12, -30]}>
        <sphereGeometry args={[18, 48, 48]} />
        <meshBasicMaterial color="#1fc8ff" transparent opacity={0.09} />
      </mesh>
      <mesh ref={nebulaC} position={[2, 24, -42]}>
        <sphereGeometry args={[22, 48, 48]} />
        <meshBasicMaterial color="#ffbb57" transparent opacity={0.05} />
      </mesh>
      <mesh ref={nebulaD} position={[-10, -20, -38]}>
        <sphereGeometry args={[18, 48, 48]} />
        <meshBasicMaterial color="#8d4eff" transparent opacity={0.06} />
      </mesh>

      <group position={[0, 6, -26]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[7.4, 0.12, 18, 120]} />
          <meshBasicMaterial color="#6fdfff" transparent opacity={0.08} depthWrite={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2.8, Math.PI / 5, 0]}>
          <torusGeometry args={[5.6, 0.08, 16, 96]} />
          <meshBasicMaterial color="#d9f8ff" transparent opacity={0.06} depthWrite={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[3.8, 28, 28]} />
          <meshBasicMaterial color="#6fdfff" transparent opacity={0.03} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

function MapHologram() {
  return (
    <group position={[13, 9, -12]}>
      <mesh rotation={[0, -0.35, 0]}>
        <boxGeometry args={[4.9, 6.8, 0.16]} />
        <meshStandardMaterial color="#091824" emissive="#123648" emissiveIntensity={0.12} metalness={0.72} roughness={0.28} transparent opacity={0.46} />
      </mesh>
      <mesh rotation={[0, -0.35, 0]} position={[0, 0, 0.11]}>
        <planeGeometry args={[4.3, 6.1, 18, 24]} />
        <meshBasicMaterial color="#8fe9ff" transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <mesh rotation={[0, -0.35, 0]} position={[0, 0, 0.18]}>
        <ringGeometry args={[0.72, 0.88, 40]} />
        <meshBasicMaterial color="#c9f6ff" transparent opacity={0.42} depthWrite={false} />
      </mesh>
      <mesh rotation={[0, -0.35, 0]} position={[0, 0, 0.17]}>
        <ringGeometry args={[1.28, 1.36, 48]} />
        <meshBasicMaterial color="#7fe7ff" transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <mesh rotation={[0, -0.35, 0]} position={[0, -2.48, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 1.9, 12]} />
        <meshStandardMaterial color="#6dcfff" emissive="#4dbfff" emissiveIntensity={0.18} metalness={0.84} roughness={0.18} />
      </mesh>
      <Html transform position={[0.05, -3.55, 0.24]} center distanceFactor={18}>
        <div className="map-hologram-tag">Blackhole + cosmic map anchor</div>
      </Html>
    </group>
  );
}

function CameraReset({ tick, onIntroDone }) {
  const { camera, controls } = useThree();

  useEffect(() => {
    const t = setTimeout(() => {
      if (onIntroDone) onIntroDone();
    }, 2200);
    return () => clearTimeout(t);
  }, [onIntroDone]);

  useEffect(() => {
    camera.position.set(0, 2.4, 36);
    camera.lookAt(0, 0, 0);
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }, [camera, controls, tick]);

  return null;
}




function FlyShipRig({ enabled, resetTick, onFlightStats, freeplayMode = false }) {
  const { camera, controls } = useThree();
  const shipRef = useRef(null);
  const flameCore = useRef(null);
  const flameLeft = useRef(null);
  const flameRight = useRef(null);
  const keys = useRef({});
  const velocity = useRef(new THREE.Vector3());
  const shipPos = useRef(new THREE.Vector3(0, 1.4, 26));
  const yaw = useRef(0);
  const pitch = useRef(-0.02);
  const roll = useRef(0);
  const dragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });
  const boostMeter = useRef(100);

  useEffect(() => {
    const onKeyDown = (e) => { keys.current[e.code] = true; };
    const onKeyUp = (e) => { keys.current[e.code] = false; };
    const onMouseDown = (e) => {
      if (!enabled) return;
      dragging.current = true;
      prevMouse.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { dragging.current = false; };
    const onMouseMove = (e) => {
      if (!enabled || !dragging.current) return;
      const dx = e.clientX - prevMouse.current.x;
      const dy = e.clientY - prevMouse.current.y;
      prevMouse.current = { x: e.clientX, y: e.clientY };
      yaw.current -= dx * 0.0025;
      pitch.current -= dy * 0.0018;
      const limit = Math.PI / 2.45;
      pitch.current = Math.max(-limit, Math.min(limit, pitch.current));
    };

    const onPilotKey = (e) => {
      const detail = e.detail || {};
      if (!detail.code) return;
      keys.current[detail.code] = Boolean(detail.active);
    };

    const onPilotLook = (e) => {
      if (!enabled) return;
      const detail = e.detail || {};
      const dx = Number(detail.dx || 0);
      const dy = Number(detail.dy || 0);
      yaw.current -= dx * 0.004;
      pitch.current -= dy * 0.003;
      const limit = Math.PI / 2.45;
      pitch.current = Math.max(-limit, Math.min(limit, pitch.current));
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('pilot-key', onPilotKey);
    window.addEventListener('pilot-look', onPilotLook);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('pilot-key', onPilotKey);
      window.removeEventListener('pilot-look', onPilotLook);
    };
  }, [enabled]);

  useEffect(() => {
    shipPos.current.set(0, 1.4, 26);
    velocity.current.set(0, 0, 0);
    yaw.current = 0;
    pitch.current = -0.02;
    roll.current = 0;
    boostMeter.current = 100;
    if (controls) controls.enabled = !enabled;
  }, [enabled, resetTick, controls]);


  useFrame((state, delta) => {
    if (!shipRef.current) return;

    if (!enabled) {
      shipRef.current.visible = false;
      onFlightStats?.({
        speed: 0,
        boosting: false,
        boostLevel: boostMeter.current,
        gravityTarget: '—',
        zone: 'Navigation',
        position: [shipPos.current.x, shipPos.current.y, shipPos.current.z],
        mode: 'spectate',
      });
      return;
    }

    shipRef.current.visible = true;

    const rawBoost = keys.current['ControlLeft'] || keys.current['ControlRight'];
    const canBoost = boostMeter.current > 4;
    const boost = rawBoost && canBoost;
    const maxSpeed = freeplayMode ? (boost ? 72 : 40) : (boost ? 24 : 12);
    const accel = freeplayMode ? (boost ? 0.22 : 0.16) : (boost ? 0.16 : 0.10);

    if (boost) {
      boostMeter.current = Math.max(0, boostMeter.current - delta * 20);
    } else {
      boostMeter.current = Math.min(100, boostMeter.current + delta * 10);
    }

    const targetRoll =
      (keys.current['KeyD'] ? -0.22 : 0) +
      (keys.current['KeyA'] ? 0.22 : 0) +
      (keys.current['KeyQ'] ? 0.16 : 0) +
      (keys.current['KeyE'] ? -0.16 : 0);

    roll.current += (targetRoll - roll.current) * 0.08;

    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(pitch.current, yaw.current, roll.current, 'YXZ')
    );

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat).normalize();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat).normalize();

    const move = new THREE.Vector3();
    if (keys.current['KeyW']) move.add(forward);
    if (keys.current['ArrowUp']) move.add(forward);
    if (keys.current['KeyS']) move.addScaledVector(forward, -0.7);
    if (keys.current['ArrowDown']) move.addScaledVector(forward, -0.7);
    if (keys.current['KeyD']) move.add(right);
    if (keys.current['ArrowRight']) move.add(right);
    if (keys.current['KeyA']) move.addScaledVector(right, -1);
    if (keys.current['ArrowLeft']) move.addScaledVector(right, -1);
    if (keys.current['Space']) move.add(up);
    if (keys.current['KeyR']) move.add(up);
    if (keys.current['ShiftLeft'] || keys.current['ShiftRight']) move.addScaledVector(up, -1);
    if (keys.current['KeyF']) move.addScaledVector(up, -1);

    if (move.lengthSq() > 0) {
      move.normalize();
      velocity.current.lerp(move.multiplyScalar(maxSpeed), accel);
    } else {
      velocity.current.lerp(new THREE.Vector3(), freeplayMode ? 0.018 : 0.035);
    }

    let gravityTarget = 'None';
    let strongestPull = 0;
    if (!freeplayMode) {
      const gravityAnchors = [
        { label: 'Arma3', pos: [-9.4, 3.0, 0], radius: 6.5, pull: 1.6 },
        { label: 'S&Box', pos: [0, 8.2, 0], radius: 5.4, pull: 1.2 },
        { label: 'T-Central Hub', pos: [0, -6.0, 0], radius: 8.5, pull: 2.2 },
        { label: 'Deep Black Hole', pos: [-12.2, -5.8, -0.3], radius: 7.0, pull: 1.9 },
      ];

      for (const anchor of gravityAnchors) {
        const d = distance3(anchor.pos, shipPos.current);
        if (d < anchor.radius) {
          const pullFactor = (1 - d / anchor.radius) * anchor.pull;
          if (pullFactor > strongestPull) {
            strongestPull = pullFactor;
            gravityTarget = anchor.label;
          }
          const dir = new THREE.Vector3(anchor.pos[0], anchor.pos[1], anchor.pos[2]).sub(shipPos.current).normalize();
          velocity.current.addScaledVector(dir, pullFactor * delta);
        }
      }
    } else {
      gravityTarget = 'Freeplay';
    }

    shipPos.current.addScaledVector(velocity.current, delta);

    shipRef.current.position.copy(shipPos.current);
    shipRef.current.quaternion.copy(quat);

    const thrust = Math.min(1.75, velocity.current.length() / maxSpeed + (boost ? 0.35 : 0));
    const pulse = 0.9 + Math.sin(state.clock.elapsedTime * 26) * 0.1;
    if (flameCore.current) flameCore.current.scale.set(1, 1, pulse * thrust + 0.18);
    if (flameLeft.current) flameLeft.current.scale.set(1, 1, pulse * thrust + 0.14);
    if (flameRight.current) flameRight.current.scale.set(1, 1, pulse * thrust + 0.14);

    const camOffset = new THREE.Vector3(0, 0.72, 3.65).applyQuaternion(quat);
    const desiredCam = shipPos.current.clone().add(camOffset);
    camera.position.lerp(desiredCam, 0.08);

    const lookTarget = shipPos.current.clone().add(forward.clone().multiplyScalar(12));
    const lookMatrix = new THREE.Matrix4().lookAt(camera.position, lookTarget, camera.up);
    const lookQuat = new THREE.Quaternion().setFromRotationMatrix(lookMatrix);
    camera.quaternion.slerp(lookQuat, 0.18);

    if (controls) {
      controls.target.copy(lookTarget);
      controls.update();
    }

    let zone = 'Open Space';
    if (shipPos.current.y > 5) zone = 'Upper Sectors';
    else if (shipPos.current.y < -4) zone = 'Lower Hub';
    else zone = 'Central Band';

    onFlightStats?.({
      speed: velocity.current.length(),
      boosting: boost,
      boostLevel: boostMeter.current,
      gravityTarget,
      zone,
      position: [shipPos.current.x, shipPos.current.y, shipPos.current.z],
      mode: enabled ? 'pilot' : 'spectate',
    });
  });




  return (
    <group ref={shipRef} visible={false} scale={0.5} rotation={[Math.PI / 2, 0, 0]}>
      <group>
        {/* rounded exploration hull */}
        <mesh position={[0, 0.02, 1.18]}>
          <capsuleGeometry args={[0.18, 1.25, 14, 22]} />
          <meshStandardMaterial color="#eef7ff" emissive="#8fe4ff" emissiveIntensity={0.1} metalness={0.56} roughness={0.28} />
        </mesh>

        <mesh position={[0, 0.02, 0.25]}>
          <capsuleGeometry args={[0.28, 1.72, 16, 24]} />
          <meshStandardMaterial color="#6b8097" metalness={0.46} roughness={0.34} />
        </mesh>

        <mesh position={[0, 0.02, -0.82]}>
          <capsuleGeometry args={[0.32, 1.48, 16, 24]} />
          <meshStandardMaterial color="#61758c" metalness={0.44} roughness={0.36} />
        </mesh>

        {/* habitation section */}
        <mesh position={[0, 0.1, -0.05]} scale={[1.18, 0.82, 1.08]}>
          <sphereGeometry args={[0.42, 28, 28]} />
          <meshStandardMaterial color="#7388a1" metalness={0.34} roughness={0.42} />
        </mesh>

        {/* cockpit / observation dome */}
        <mesh position={[0, 0.28, 0.62]} scale={[0.9, 0.42, 1.28]}>
          <sphereGeometry args={[0.26, 28, 28]} />
          <meshStandardMaterial color="#bdefff" emissive="#8fe4ff" emissiveIntensity={0.18} transparent opacity={0.7} />
        </mesh>

        {/* habitation windows */}
        <mesh position={[0.19, 0.11, -0.02]}>
          <sphereGeometry args={[0.05, 18, 18]} />
          <meshBasicMaterial color="#dffcff" transparent opacity={0.85} />
        </mesh>
        <mesh position={[-0.19, 0.11, -0.02]}>
          <sphereGeometry args={[0.05, 18, 18]} />
          <meshBasicMaterial color="#dffcff" transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 0.14, -0.22]}>
          <sphereGeometry args={[0.045, 18, 18]} />
          <meshBasicMaterial color="#dffcff" transparent opacity={0.8} />
        </mesh>

        {/* soft dorsal communications spine */}
        <mesh position={[0, 0.34, -0.32]} rotation={[0.08, 0, 0]}>
          <capsuleGeometry args={[0.05, 0.72, 10, 16]} />
          <meshStandardMaterial color="#788ba0" metalness={0.28} roughness={0.44} />
        </mesh>
        <mesh position={[0.0, 0.5, -0.08]}>
          <cylinderGeometry args={[0.018, 0.018, 0.42, 10]} />
          <meshStandardMaterial color="#a8bed2" metalness={0.25} roughness={0.48} />
        </mesh>

        {/* rounded side pods */}
        <mesh position={[-0.42, 0.02, -0.32]} scale={[0.62, 0.52, 1.08]}>
          <sphereGeometry args={[0.2, 22, 22]} />
          <meshStandardMaterial color="#5a6d83" metalness={0.34} roughness={0.42} />
        </mesh>
        <mesh position={[0.42, 0.02, -0.32]} scale={[0.62, 0.52, 1.08]}>
          <sphereGeometry args={[0.2, 22, 22]} />
          <meshStandardMaterial color="#5a6d83" metalness={0.34} roughness={0.42} />
        </mesh>

        {/* gentle wing/solar structures */}
        <mesh position={[-0.9, -0.04, -0.18]} rotation={[0.04, 0.04, 0.08]}>
          <boxGeometry args={[1.08, 0.03, 0.64]} />
          <meshStandardMaterial color="#95a9c3" metalness={0.3} roughness={0.42} />
        </mesh>
        <mesh position={[0.9, -0.04, -0.18]} rotation={[0.04, -0.04, -0.08]}>
          <boxGeometry args={[1.08, 0.03, 0.64]} />
          <meshStandardMaterial color="#95a9c3" metalness={0.3} roughness={0.42} />
        </mesh>

        {/* engine assembly */}
        <mesh position={[0, -0.08, -1.56]}>
          <capsuleGeometry args={[0.18, 0.54, 12, 18]} />
          <meshStandardMaterial color="#5d7086" metalness={0.48} roughness={0.34} />
        </mesh>
        <mesh position={[-0.22, -0.1, -1.38]}>
          <capsuleGeometry args={[0.09, 0.28, 10, 14]} />
          <meshStandardMaterial color="#586b80" metalness={0.42} roughness={0.38} />
        </mesh>
        <mesh position={[0.22, -0.1, -1.38]}>
          <capsuleGeometry args={[0.09, 0.28, 10, 14]} />
          <meshStandardMaterial color="#586b80" metalness={0.42} roughness={0.38} />
        </mesh>

        {/* engine glows */}
        <mesh position={[0, -0.08, -1.86]}>
          <sphereGeometry args={[0.11, 20, 20]} />
          <meshBasicMaterial color="#9aefff" transparent opacity={0.58} />
        </mesh>
        <mesh position={[-0.22, -0.1, -1.56]}>
          <sphereGeometry args={[0.06, 18, 18]} />
          <meshBasicMaterial color="#7ce7ff" transparent opacity={0.5} />
        </mesh>
        <mesh position={[0.22, -0.1, -1.56]}>
          <sphereGeometry args={[0.06, 18, 18]} />
          <meshBasicMaterial color="#7ce7ff" transparent opacity={0.5} />
        </mesh>

        {/* thrusters */}
        <mesh ref={flameCore} position={[0, -0.08, -2.06]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.1, 0.6, 18]} />
          <meshBasicMaterial color="#90e8ff" transparent opacity={0.92} />
        </mesh>
        <mesh ref={flameLeft} position={[-0.22, -0.1, -1.72]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.045, 0.28, 16]} />
          <meshBasicMaterial color="#7ee7ff" transparent opacity={0.82} />
        </mesh>
        <mesh ref={flameRight} position={[0.22, -0.1, -1.72]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.045, 0.28, 16]} />
          <meshBasicMaterial color="#7ee7ff" transparent opacity={0.82} />
        </mesh>

        {/* restrained wireframe accents */}
        <lineSegments position={[0, 0.02, 1.18]}>
          <edgesGeometry args={[new THREE.CapsuleGeometry(0.18, 1.25, 10, 16)]} />
          <lineBasicMaterial color="#d4f7ff" transparent opacity={0.1} />
        </lineSegments>
        <lineSegments position={[0, 0.02, 0.25]}>
          <edgesGeometry args={[new THREE.CapsuleGeometry(0.28, 1.72, 12, 18)]} />
          <lineBasicMaterial color="#bceeff" transparent opacity={0.1} />
        </lineSegments>
        <lineSegments position={[0, 0.02, -0.82]}>
          <edgesGeometry args={[new THREE.CapsuleGeometry(0.32, 1.48, 12, 18)]} />
          <lineBasicMaterial color="#a7e8ff" transparent opacity={0.1} />
        </lineSegments>
        <lineSegments position={[0, 0.1, -0.05]} scale={[1.18, 0.82, 1.08]}>
          <edgesGeometry args={[new THREE.SphereGeometry(0.42, 18, 18)]} />
          <lineBasicMaterial color="#9fe8ff" transparent opacity={0.08} />
        </lineSegments>
        <lineSegments position={[-0.9, -0.04, -0.18]} rotation={[0.04, 0.04, 0.08]}>
          <edgesGeometry args={[new THREE.BoxGeometry(1.08, 0.03, 0.64)]} />
          <lineBasicMaterial color="#86ddff" transparent opacity={0.1} />
        </lineSegments>
        <lineSegments position={[0.9, -0.04, -0.18]} rotation={[0.04, -0.04, -0.08]}>
          <edgesGeometry args={[new THREE.BoxGeometry(1.08, 0.03, 0.64)]} />
          <lineBasicMaterial color="#86ddff" transparent opacity={0.1} />
        </lineSegments>
        <lineSegments position={[0, -0.08, -1.56]}>
          <edgesGeometry args={[new THREE.CapsuleGeometry(0.18, 0.54, 10, 14)]} />
          <lineBasicMaterial color="#d7f8ff" transparent opacity={0.1} />
        </lineSegments>
      </group>
    </group>
  );
}

function OrbitalMatter({ radius = 2.9, color = '#8f76ff', speed = 0.14, tilt = [Math.PI / 2.4, 0, 0], count = 44, spread = 0.16 }) {
  const ref = useRef(null);
  const particles = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const r = radius + Math.sin(i * 1.87) * spread;
    return { position: [Math.cos(angle) * r, Math.cos(i * 0.8) * 0.08, Math.sin(angle) * r], scale: 0.03 + (i % 4) * 0.008 };
  }), [count, radius, spread]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z += delta * speed;
  });

  return (
    <group ref={ref} rotation={tilt}>
      {particles.map((p, i) => (
        <mesh key={i} position={p.position} scale={p.scale}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.85} transparent opacity={0.72} />
        </mesh>
      ))}
    </group>
  );
}

function BlackHoleAnchor({ node, onSelect, title, subtitle, coreColor, ringColor, labelOffset = [0, 1.55, 0], matterRadius = 3.2 }) {
  const group = useRef(null);
  if (!node) return null;
  const disc = useRef(null);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.12;
    if (disc.current) disc.current.rotation.z += delta * 0.36;
  });

  return (
    <group position={node.position} ref={group} onClick={(e) => { e.stopPropagation(); onSelect(node); }}>
      <OrbitalMatter radius={matterRadius} color={coreColor} speed={0.10} tilt={[Math.PI / 2.46, 0.12, 0]} count={44} />
      <OrbitalMatter radius={matterRadius - 0.8} color={ringColor} speed={-0.16} tilt={[Math.PI / 2.22, -0.15, 0.18]} count={28} spread={0.12} />
      <mesh>
        <sphereGeometry args={[0.95, 56, 56]} />
        <meshStandardMaterial color="#020409" emissive="#0b1220" emissiveIntensity={1.0} />
      </mesh>
      <mesh ref={disc} rotation={[Math.PI / 2.34, 0, 0]}>
        <torusGeometry args={[1.8, 0.2, 20, 140]} />
        <meshStandardMaterial color={ringColor} emissive={ringColor} emissiveIntensity={1.2} />
      </mesh>
      <mesh rotation={[Math.PI / 2.34, 0, 0]}>
        <torusGeometry args={[2.35, 0.06, 16, 140]} />
        <meshStandardMaterial color={coreColor} emissive={coreColor} emissiveIntensity={0.72} />
      </mesh>
      <pointLight position={[0, 0, 0]} color={coreColor} intensity={18} distance={14} />
      <Html position={labelOffset} center distanceFactor={11}>
        <button className="map-anchor-label clickable" onClick={() => onSelect(node)}>
          <span className="anchor-title">{title}</span>
          <span className="anchor-copy">{subtitle}</span>
        </button>
      </Html>
    </group>
  );
}

function DysonSphere({ node, onSelect }) {
  const group = useRef(null);
  if (!node) return null;
  const ringA = useRef(null);
  const ringB = useRef(null);
  const ringC = useRef(null);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.16;
    if (ringA.current) ringA.current.rotation.x += delta * 0.42;
    if (ringB.current) ringB.current.rotation.y -= delta * 0.3;
    if (ringC.current) ringC.current.rotation.z += delta * 0.48;
  });

  return (
    <group position={node.position} ref={group} onClick={(e) => { e.stopPropagation(); onSelect(node); }}>
      <mesh><sphereGeometry args={[0.42, 24, 24]} /><meshStandardMaterial color="#ffd15c" emissive="#ffd15c" emissiveIntensity={1.95} /></mesh>
      <mesh ref={ringA}><torusGeometry args={[0.95, 0.03, 12, 120]} /><meshStandardMaterial color="#ffe694" emissive="#ffe694" emissiveIntensity={1.1} /></mesh>
      <mesh ref={ringB} rotation={[1.05, 0.25, 0.16]}><torusGeometry args={[1.22, 0.024, 12, 120]} /><meshStandardMaterial color="#ffd15c" emissive="#ffd15c" emissiveIntensity={0.95} /></mesh>
      <mesh ref={ringC} rotation={[0.2, 0.72, 1.0]}><torusGeometry args={[1.48, 0.02, 12, 120]} /><meshStandardMaterial color="#fff4c1" emissive="#fff4c1" emissiveIntensity={0.85} /></mesh>
      <Html position={[0, -1.4, 0]} center distanceFactor={10}>
        <button className="map-anchor-label clickable" onClick={() => onSelect(node)}>
          <span className="anchor-title">S.S</span>
          <span className="anchor-copy">Dyson sphere link</span>
        </button>
      </Html>
    </group>
  );
}

function StarNode({ node, onSelect }) {
  const core = useRef(null);
  if (!node) return null;
  const halo = useRef(null);

  useFrame((state, delta) => {
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.3) * 0.12;
    if (core.current) core.current.scale.setScalar(pulse);
    if (halo.current) halo.current.rotation.y += delta * 0.44;
  });

  return (
    <group position={node.position} onClick={(e) => { e.stopPropagation(); onSelect(node); }}>
      <mesh ref={core}><dodecahedronGeometry args={[0.35, 0]} /><meshStandardMaterial color={node.color} emissive={node.color} emissiveIntensity={1.95} /></mesh>
      <mesh ref={halo} rotation={[0.4, 0.2, 0]}><torusGeometry args={[1.0, 0.022, 12, 100]} /><meshStandardMaterial color={node.color} emissive={node.color} emissiveIntensity={0.95} /></mesh>
      <pointLight position={[0, 0, 0]} color={node.color} intensity={10} distance={9} />
      <Html position={[0, 1.14, 0]} center distanceFactor={10}>
        <button className="map-anchor-label clickable" onClick={() => onSelect(node)}>
          <span className="anchor-title">{node.label}</span>
          <span className="anchor-copy">{node.address}</span>
        </button>
      </Html>
    </group>
  );
}

function Planet({ planet, index }) {
  const planetRef = useRef(null);
  const ringRef = useRef(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime * planet.speed + index;
    const x = Math.cos(t) * planet.orbit;
    const z = Math.sin(t) * planet.orbit;
    if (planetRef.current) {
      planetRef.current.position.set(x, 0, z);
      planetRef.current.rotation.y += 0.02;
    }
    if (ringRef.current) {
      ringRef.current.position.set(x, 0, z);
      ringRef.current.rotation.z += 0.01;
    }
  });

  return (
    <>
      <mesh ref={planetRef}><sphereGeometry args={[planet.radius, 20, 20]} /><meshStandardMaterial color={planet.color} emissive={planet.color} emissiveIntensity={0.35} /></mesh>
      {planet.ring ? (
        <mesh ref={ringRef} rotation={[Math.PI / 2.5, 0, 0]}>
          <torusGeometry args={[planet.radius * 1.65, planet.radius * 0.18, 10, 80]} />
          <meshStandardMaterial color="#e8d7ab" emissive="#e8d7ab" emissiveIntensity={0.25} />
        </mesh>
      ) : null}
    </>
  );
}

function SolarSystem({ node, onSelect }) {
  const group = useRef(null);
  if (!node) return null;
  const sunRef = useRef(null);
  const planets = useMemo(() => [
    { name: 'Mercury', radius: 0.06, orbit: 0.9, speed: 1.3, color: '#c7b39a' },
    { name: 'Venus', radius: 0.09, orbit: 1.25, speed: 1.05, color: '#d8b47a' },
    { name: 'Earth', radius: 0.1, orbit: 1.65, speed: 0.88, color: '#5fb7ff' },
    { name: 'Mars', radius: 0.08, orbit: 2.0, speed: 0.76, color: '#d86d54' },
    { name: 'Jupiter', radius: 0.2, orbit: 2.55, speed: 0.54, color: '#d9b48b' },
    { name: 'Saturn', radius: 0.16, orbit: 3.15, speed: 0.43, color: '#e0c582', ring: true },
    { name: 'Uranus', radius: 0.12, orbit: 3.75, speed: 0.34, color: '#9ce3ff' },
    { name: 'Neptune', radius: 0.12, orbit: 4.25, speed: 0.28, color: '#628dff' },
    { name: 'Pluto', radius: 0.05, orbit: 4.8, speed: 0.22, color: '#b3b3c9' },
  ], []);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.04;
    if (sunRef.current) sunRef.current.rotation.y += delta * 0.18;
  });

  return (
    <group position={node.position} ref={group} onClick={(e) => { e.stopPropagation(); onSelect(node); }}>
      <mesh ref={sunRef}><sphereGeometry args={[0.42, 32, 32]} /><meshStandardMaterial color="#ffd46b" emissive="#ffd46b" emissiveIntensity={2.2} /></mesh>
      {planets.map((planet, i) => (
        <group key={planet.name}>
          <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[planet.orbit, 0.008, 8, 120]} /><meshBasicMaterial color="white" transparent opacity={0.12} /></mesh>
          <Planet planet={planet} index={i} />
        </group>
      ))}
      <pointLight position={[0, 0, 0]} color="#ffd46b" intensity={18} distance={10} />
      <Html position={[0, -1.25, 0]} center distanceFactor={11}>
        <button className="map-anchor-label clickable" onClick={() => onSelect(node)}>
          <span className="anchor-title">Solar System</span>
          <span className="anchor-copy">Sun + 9 planets</span>
        </button>
      </Html>
    </group>
  );
}

function SectorRing({ position, radius, color, label }) {
  const ref = useRef(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z += delta * 0.06;
  });

  return (
    <group position={position}>
      <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.018, 10, 220]} />
        <meshBasicMaterial color={color} transparent opacity={0.26} />
      </mesh>
      <Html position={[0, radius + 0.65, 0]} center><div className="sector-label">{label}</div></Html>
    </group>
  );
}

function ConstellationLines() {
  const pointGroups = useMemo(() => [
    [NODES.find((n) => n.key === 'arma3').position, NODES.find((n) => n.key === 'sbox').position, NODES.find((n) => n.key === 'ss').position, NODES.find((n) => n.key === 'ns').position],
    [NODES.find((n) => n.key === 'rust_anchor').position, NODES.find((n) => n.key === 'rust_biweekly').position, NODES.find((n) => n.key === 'rust_weekly').position, NODES.find((n) => n.key === 'rust_monthly').position],
    [NODES.find((n) => n.key === 'ss').position, NODES.find((n) => n.key === 'report').position, NODES.find((n) => n.key === 'nfo').position],
    [NODES.find((n) => n.key === 'deep_blackhole').position, NODES.find((n) => n.key === 'rust_anchor').position, NODES.find((n) => n.key === 'solar_system').position],
  ], []);

  return (
    <>
      {pointGroups.map((group, i) => (
        <Line key={i} points={group} color="#71e9ff" transparent opacity={0.14} lineWidth={1} />
      ))}
    </>
  );
}

function StatusNode({ node, status, selected, onHover, onLeave, onSelect }) {
  const mesh = useRef(null);
  if (!node) return null;
  const glowColor = status?.online === true ? '#73ff9e' : status?.online === false ? '#ff7d7d' : node.color;

  useFrame((state) => {
    if (!mesh.current) return;
    mesh.current.position.y = node.position[1] + Math.sin(state.clock.elapsedTime * 1.05 + node.position[0]) * 0.06;
    mesh.current.rotation.y += 0.01;
  });

  return (
    <group position={node.position}>
      <Trail width={0.4} length={2.2} color={glowColor} attenuation={(t) => t * t}>
        <mesh
          ref={mesh}
          onPointerOver={(e) => { e.stopPropagation(); onHover(node.key); }}
          onPointerOut={(e) => { e.stopPropagation(); onLeave(); }}
          onClick={(e) => { e.stopPropagation(); onSelect(node); }}
        >
          <icosahedronGeometry args={[selected ? 0.32 : 0.27, 1]} />
          <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={selected ? 1.55 : 1.0} />
        </mesh>
      </Trail>
      <mesh><sphereGeometry args={[selected ? 0.6 : 0.5, 20, 20]} /><meshBasicMaterial color={glowColor} transparent opacity={selected ? 0.15 : 0.08} /></mesh>
      <Html center distanceFactor={8.8} position={[0, selected ? 0.92 : 0.78, 0]}>
        <button className={`map-node-label ${selected ? 'active' : ''}`} onMouseEnter={() => onHover(node.key)} onMouseLeave={onLeave} onClick={() => onSelect(node)}>
          <strong>{node.label}</strong>
          <span>{node.address}</span>
          <em>{node.description}</em>
          <small>{formatStatus(status)}</small>
        </button>
      </Html>
    </group>
  );
}

function Scene({ statuses, onSelect, resetTick, freeFly, onFlightStats, remotePlayers, reducedScene, isMobile, onIntroDone, freeplayMode = false }) {
  const [hovered, setHovered] = useState('rust_biweekly');

  return (
    <>
      {!reducedScene ? <DynamicBackgroundField /> : null}
      <MultiplayerPresenceMarkers players={remotePlayers || []} />
      {!isMobile ? <MapHologram /> : null}
      <ambientLight intensity={1.05} />
      <directionalLight position={[5, 7, 4]} intensity={1.25} color="#bdefff" />
      <pointLight position={[-7, 3, 4]} intensity={12} color="#6fdfff" distance={18} />
      <pointLight position={[7, 3, -2]} intensity={8} color="#b78dff" distance={18} />
      <fog attach="fog" args={['#090311', reducedScene ? 15 : 17, reducedScene ? 34 : 42]} />
      <Stars radius={96} depth={44} count={reducedScene ? 1400 : 4200} factor={reducedScene ? 2.6 : 4.2} saturation={0} fade speed={reducedScene ? 0.4 : 0.9} />

      <group rotation={[-0.10, -0.03, 0]}>
        <SectorRing position={[-12.8, 5.0, -2.8]} radius={4.6} color="#58dfff" label="Arma" />
        <SectorRing position={[3.4, 10.8, -4.4]} radius={4.0} color="#67d7ff" label="S&Box" />
        <SectorRing position={[-2.4, -7.8, 2.8]} radius={6.2} color="#9f7cff" label="Hub" />
        <SectorRing position={[12.8, 5.4, 3.2]} radius={4.6} color="#ffd15c" label="Support" />
        <SectorRing position={[-17.2, -3.6, -5.8]} radius={4.3} color="#c4d4ff" label="Deep" />
        <SectorRing position={[7.4, 2.2, 5.0]} radius={4.5} color="#ffd46b" label="Solar" />

        <ConstellationLines />

        <BlackHoleAnchor node={NODES.find((n) => n.key === 'arma3')} onSelect={onSelect} title="Arma3 Black Hole" subtitle="Tactical anchor" coreColor="#00eaff" ringColor="#8beaff" labelOffset={[0, 1.55, 0]} matterRadius={3.1} />
        <BlackHoleAnchor node={NODES.find((n) => n.key === 'sbox')} onSelect={onSelect} title="S&Box Black Hole" subtitle="Sandbox anchor" coreColor="#67d7ff" ringColor="#b6f3ff" labelOffset={[0, 1.55, 0]} matterRadius={2.7} />
        <BlackHoleAnchor node={NODES.find((n) => n.key === 'rust_anchor')} onSelect={onSelect} title="T-Central Hub" subtitle="Lower singularity anchor" coreColor="#8e71ff" ringColor="#86e7ff" labelOffset={[0, -1.95, 0]} matterRadius={3.4} />
        <BlackHoleAnchor node={NODES.find((n) => n.key === 'deep_blackhole')} onSelect={onSelect} title="Deep Black Hole" subtitle="Standalone anchor" coreColor="#d8e0ff" ringColor="#a8b8ff" labelOffset={[0, -1.9, 0]} matterRadius={2.8} />

        <DysonSphere node={NODES.find((n) => n.key === 'ss')} onSelect={onSelect} />
        <SolarSystem node={NODES.find((n) => n.key === 'solar_system')} onSelect={onSelect} />
        <StarNode node={NODES.find((n) => n.key === 'ns')} onSelect={onSelect} />
        <StarNode node={NODES.find((n) => n.key === 'nfo')} onSelect={onSelect} />

        {NODES.filter((n) => n.kind === 'node').map((node) => (
          <StatusNode key={node.key} node={node} status={statuses?.[node.key]} selected={hovered === node.key} onHover={setHovered} onLeave={() => setHovered('rust_biweekly')} onSelect={onSelect} />
        ))}
      </group>

      <OrbitControls
        makeDefault
        enablePan={!freeFly}
        enableZoom
        enableRotate
        minDistance={2}
        maxDistance={135}
        autoRotate={false}
        zoomSpeed={1.0}
        rotateSpeed={0.8}
        panSpeed={0.9}
        screenSpacePanning
        maxPolarAngle={Math.PI}
        minPolarAngle={0}
      />
      <CameraReset tick={resetTick} onIntroDone={onIntroDone} />
      <FlyShipRig enabled={freeFly} resetTick={resetTick} onFlightStats={onFlightStats} freeplayMode={freeplayMode} />
    </>
  );
}


function MultiplayerPresenceMarkers({ players }) {
  return (
    <group>
      {players.map((player) => (
        <group key={player.steamid} position={player.position || [0, 1.4, 26]}>
          <mesh>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshBasicMaterial color={player.mode === 'pilot' ? '#83ebff' : '#ffd15c'} />
          </mesh>
          <pointLight color={player.mode === 'pilot' ? '#83ebff' : '#ffd15c'} intensity={2.4} distance={2.8} />
          <Html position={[0, 0.36, 0]} center distanceFactor={12}>
            <div className="presence-marker-label">
              <strong>{player.personaname || 'Player'}</strong>
              <span>{player.mode === 'pilot' ? 'Pilot' : 'Spectate'}</span>
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}



function RoomPulse({ freeFly, remotePlayers }) {
  const count = Array.isArray(remotePlayers) ? remotePlayers.length : 0;
  return (
    <div className={`room-pulse ${freeFly ? 'pilot' : 'spectate'}`}>
      <span className="pilot-assist-kicker">Room pulse</span>
      <strong>{freeFly ? 'Pilot lane active' : 'Spectate lane active'}</strong>
      <p>{count} remote player{count === 1 ? '' : 's'} visible in the shared layer.</p>
    </div>
  );
}

function FocusPanel({ item, statuses, onClose, onOpen }) {
  if (!item) return null;
  const status = item.key ? statuses?.[item.key] : null;
  const openable = Boolean(item.route || item.href);

  return (
    <div className="map-focus-panel">
      <div className="map-focus-header">
        <div><p className="eyebrow">Selected node</p><h4>{item.label}</h4></div>
        <button className="focus-close" onClick={onClose}>×</button>
      </div>
      <p className="muted">{item.description}</p>
      <div className="focus-meta"><span>{item?.address || item?.sublabel || 'No address'}</span>{item?.kind ? <span>{item.kind}</span> : null}</div>
      {item.key && status ? (
        <div className="focus-status">
          <div className="status-row"><span>Status</span><strong>{status.online === true ? 'Online' : status.online === false ? 'Offline' : 'Unavailable'}</strong></div>
          <div className="status-row"><span>Players</span><strong>{formatStatus(status)}</strong></div>
          {status.map ? <div className="status-row"><span>Map</span><strong>{status.map}</strong></div> : null}
          {status.source ? <div className="status-note">{status.source}</div> : null}
        </div>
      ) : null}
      <div className="button-column">
        {openable ? <button className="button primary" onClick={() => onOpen(item)}>{item?.key === 'arma3' ? 'Warp into system' : 'Open destination'}</button> : null}
        <button className="button secondary" onClick={onClose}>Clear selection</button>
      </div>
    </div>
  );
}



function Arma3BlackholeInterior({ item, statuses, onClose }) {
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState('best');
  const [copiedIp, setCopiedIp] = useState('');
  if (!item || item.key !== 'arma3') return null;

  const servers = SERVER_CATALOG.arma3.map((server) => {
    const linked = server.statusKey ? statuses?.[server.statusKey] : null;
    const players = typeof linked?.players === 'number' ? linked.players : 0;
    const maxPlayers = typeof linked?.maxPlayers === 'number' ? linked.maxPlayers : 100;
    const online = linked?.online === true;
    const occupancy = maxPlayers > 0 ? players / maxPlayers : 0;
    return {
      ...server,
      online,
      players,
      maxPlayers,
      liveMap: linked?.map || server.map,
      occupancy,
      joinUrl: `steam://connect/${server.ip}`,
      launchUrl: `steam://run/${server.steamAppId || '107410'}`,
    };
  });

  const filtered = servers
    .filter((server) => {
      const haystack = [server.title, server.ip, server.game, server.mode, server.liveMap, ...(server.tags || [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    })
    .sort((a, b) => {
      if (sortMode === 'players') return b.players - a.players;
      if (sortMode === 'name') return a.title.localeCompare(b.title);
      if (sortMode === 'mode') return a.mode.localeCompare(b.mode);
      const score = (s) => (s.online ? 1000 : 0) + (s.players * 4) + (s.tier === 'Primary' ? 60 : 0) - Math.abs(0.72 - s.occupancy) * 100;
      return score(b) - score(a);
    });

  const bestServer = filtered[0] || null;

  const copyIp = async (ip) => {
    try {
      await navigator.clipboard.writeText(ip);
      setCopiedIp(ip);
      window.setTimeout(() => setCopiedIp(''), 1400);
    } catch {}
  };

  return (
    <div className="blackhole-interior-overlay">
      <div className="blackhole-interior-shell">
        <div className="blackhole-interior-backdrop">
          <div className="interior-grid-sphere sphere-a" />
          <div className="interior-grid-sphere sphere-b" />
          <div className="interior-terrain-hologram">
            <div className="terrain-ring ring-outer" />
            <div className="terrain-ring ring-mid" />
            <div className="terrain-ring ring-inner" />
            <div className="capture-core" />
          </div>
        </div>

        <div className="blackhole-interior-content">
          <div className="blackhole-interior-header">
            <div>
              <p className="eyebrow">Arma3 blackhole interior</p>
              <h2>Warping into Arma3 system</h2>
              <p className="muted">
                Warp into the Arma3 CTH system, review the Altis battlefield briefing, and connect through Steam from one command sphere.
              </p>
            </div>
            <button className="focus-close" onClick={onClose}>×</button>
          </div>

          <div className="browser-topbar">
            <div className="browser-search-wrap">
              <input
                className="browser-search"
                placeholder="Search the live server, map, or IP"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="browser-sort">
              <button className={sortMode === 'best' ? 'active' : ''} onClick={() => setSortMode('best')}>Primary</button>
              <button className={sortMode === 'players' ? 'active' : ''} onClick={() => setSortMode('players')}>Players</button>
              <button className={sortMode === 'name' ? 'active' : ''} onClick={() => setSortMode('name')}>Name</button>
              <button className={sortMode === 'mode' ? 'active' : ''} onClick={() => setSortMode('mode')}>Mode</button>
            </div>
          </div>

          {bestServer ? (
            <div className="browser-highlight-card">
              <div>
                <span className="interior-step">Primary live server</span>
                <h3>{bestServer.title}</h3>
                <p className="muted">
                  Primary live route based on your current single-server setup.
                </p>
              </div>
              <div className="highlight-actions">
                <a className="button secondary" href={bestServer.launchUrl}>Launch Arma 3</a>
                <a className="button primary" href={bestServer.joinUrl}>Quick Connect</a>
              </div>
            </div>
          ) : null}


              <div className="browser-brief-grid">
                <article className="browser-brief-card">
                  <span className="interior-step">System briefing</span>
                  <h3>Arma3 CTH tactical briefing</h3>
                  <ul className="arma-list">
                    <li>Capture the Hill centers combat around control of a live central objective.</li>
                    <li>Players re-enter quickly, contest the hill, and fight for momentum and territory.</li>
                    <li>The focus is fast tactical pressure, repeat engagement, and clear battlefield flow.</li>
                    <li>This route is aligned around one live public Arma3 CTH server overall.</li>
                  </ul>
                </article>

                <article className="browser-brief-card browser-map-card">
                  <span className="interior-step">Altis reference</span>
                  <h3>Battlefield map</h3>
                  <div className="browser-map-media procedural-browser-map">
                    <div className="procedural-browser-map-core" />
                    <div className="procedural-browser-map-ring" />
                    <div className="procedural-browser-map-grid" />
                  </div>
                </article>
              </div>

              <div className="server-browser-list">
            {filtered.map((server) => (
              <article key={server.id} className="browser-server-card">
                <div className="browser-server-main">
                  <div className="browser-server-titleline">
                    <strong>{server.title}</strong>
                    <span className={`browser-state ${server.online ? 'online' : ''}`}>
                      {server.online ? 'Online' : 'Unavailable'}
                    </span>
                  </div>

                  <div className="browser-server-meta">
                    <span>{server.mode}</span>
                    <span>{server.liveMap}</span>
                    <span>{server.ip}</span>
                  </div>
                </div>

                <div className="browser-server-stats">
                  <div>
                    <span>Players</span>
                    <strong>{server.players} / {server.maxPlayers}</strong>
                  </div>
                  <div>
                    <span>Tier</span>
                    <strong>{server.tier}</strong>
                  </div>
                </div>

                <div className="browser-server-actions">
                  <button className="button secondary" onClick={() => copyIp(server.ip)}>
                    {copiedIp === server.ip ? 'Copied' : 'Copy IP'}
                  </button>
                  <a className="button secondary" href={server.launchUrl}>Launch Arma 3</a>
                  <a className="button primary" href={server.joinUrl}>Quick Connect</a>
                </div>
              </article>
            ))}

            {filtered.length === 0 ? (
              <div className="browser-empty-state">
                No result matched that search.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function WarpOverlay
({ label }) {
  return (
    <div className="transition-overlay warp-enter">
      <div className="warp-rings"><span /><span /><span /></div>
      <div className="transition-copy">Warping into {label}</div>
    </div>
  );
}


function distance3(a, b) {
  return Math.sqrt(
    (a[0] - b.x) ** 2 +
    (a[1] - b.y) ** 2 +
    (a[2] - b.z) ** 2
  );
}



function FixedNav({ onCenter, onPilotToggle, freeFly, freeplayMode, onFreeplayToggle }) {
  return (
    <div className="hud-bottom-fixed">
      <button onClick={onCenter}>Center</button>
      <button onClick={onPilotToggle}>{freeFly ? 'Exit Pilot' : 'Pilot'}</button>
      <button onClick={onFreeplayToggle} disabled={!freeFly}>{freeplayMode ? 'Freeplay On' : 'Freeplay Off'}</button>
      <a href="/report-player"><button>Report</button></a>
    </div>
  );
}

function Radar({ freeFly, target }) {
  return (
    <div className={`radar ${freeFly ? 'active' : ''}`}>
      <div className="radar-ring ring-1" />
      <div className="radar-ring ring-2" />
      <div className="radar-ring ring-3" />
      <div className="radar-sweep" />
      <div className="radar-center" />
      {target ? <div className="radar-target" /> : null}
      <div className="radar-label">{target || 'No lock'}</div>
    </div>
  );
}

function CockpitOverlay({ freeFly, flightStats, selected }) {
  const safeStats = flightStats || { position: [0,0,0], velocity: [0,0,0], speed: 0, boosting: false, boostLevel: 100, gravityTarget: 'None', zone: 'Navigation', mode: 'spectate' };
  return (
    <div className={`cockpit-overlay ${freeFly ? 'active' : ''}`}>
      <div className="cockpit-frame top-left" />
      <div className="cockpit-frame top-right" />
      <div className="cockpit-frame bottom-left" />
      <div className="cockpit-frame bottom-right" />

      <div className="cockpit-panel left">
        <div className="panel-title">Navigation</div>
        <div className="panel-row"><span>Mode</span><strong>{freeFly ? 'Pilot' : 'Observer'}</strong></div>
        <div className="panel-row"><span>Zone</span><strong>{safeStats.zone || '—'}</strong></div>
        <div className="panel-row"><span>Pull</span><strong>{safeStats.gravityTarget || '—'}</strong></div>
      </div>

      <div className="cockpit-panel right">
        <div className="panel-title">Flight</div>
        <div className="panel-row"><span>Speed</span><strong>{Math.round(safeStats.speed || 0)}</strong></div>
        <div className="panel-row"><span>Boost</span><strong>{safeStats.boosting ? 'Active' : 'Standby'}</strong></div>
        <div className="panel-row"><span>Target</span><strong>{selected?.label || 'None'}</strong></div>
      </div>

      <Radar freeFly={freeFly} target={selected?.label || safeStats.gravityTarget} />

      {freeFly ? (
        <>
          <div className="target-reticle">
            <span className="reticle-ring" />
            <span className="reticle-dot" />
          </div>
          <div className="scanline scanline-a" />
          <div className="scanline scanline-b" />
        </>
      ) : null}
    </div>
  );
}

function SteamIdentityPanel() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch('/api/auth/steam/session', { cache: 'no-store' });
        const data = await res.json();
        if (!active) return;
        setSession(data?.authenticated ? data.user : null);
      } catch {
        if (!active) return;
        setSession(null);
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="steam-identity-panel">
      <span className="steam-kicker">Identity</span>
      {session ? (
        <div className="steam-identity-row">
          {session.avatar ? <img src={session.avatar} alt={session.personaname || 'Steam avatar'} className="steam-identity-avatar" /> : null}
          <div>
            <strong>{session.personaname || 'Steam user'}</strong>
            <small>{session.steamid}</small>
          </div>
        </div>
      ) : (
        <div className="steam-identity-row">
          <div>
            <strong>Guest</strong>
            <small>Sign in with Steam to bind identity</small>
          </div>
        </div>
      )}
    </div>
  );
}


function MobilePilotControls({ visible }) {
  const [touchActive, setTouchActive] = useState(false);
  const lookStart = useRef(null);

  if (!visible) return null;

  const setKey = (code, active) => {
    window.dispatchEvent(new CustomEvent('pilot-key', { detail: { code, active } }));
  };

  const bindHold = (code) => ({
    onTouchStart: (e) => {
      e.preventDefault();
      setTouchActive(true);
      setKey(code, true);
    },
    onTouchEnd: (e) => {
      e.preventDefault();
      setKey(code, false);
      setTouchActive(false);
    },
    onTouchCancel: () => {
      setKey(code, false);
      setTouchActive(false);
    },
  });

  const handleLookStart = (e) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    lookStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookMove = (e) => {
    const touch = e.touches?.[0];
    if (!touch || !lookStart.current) return;
    const dx = touch.clientX - lookStart.current.x;
    const dy = touch.clientY - lookStart.current.y;
    lookStart.current = { x: touch.clientX, y: touch.clientY };
    window.dispatchEvent(new CustomEvent('pilot-look', { detail: { dx, dy } }));
  };

  const handleLookEnd = () => {
    lookStart.current = null;
  };

  return (
    <div className="mobile-pilot-ui">
      <div className="mobile-pilot-hint">
        <strong>Pilot mode</strong>
        <span>Use thrust buttons and drag the right pad to steer.</span>
      </div>

      <div className="mobile-pilot-bottom">
        <div className="mobile-thrust-cluster">
          <button className="touch-key touch-wide" {...bindHold('KeyW')}>Forward</button>
          <div className="touch-key-row">
            <button className="touch-key" {...bindHold('KeyA')}>Left</button>
            <button className="touch-key" {...bindHold('KeyS')}>Back</button>
            <button className="touch-key" {...bindHold('KeyD')}>Right</button>
          </div>
          <div className="touch-key-row">
            <button className="touch-key" {...bindHold('Space')}>Up</button>
            <button className="touch-key" {...bindHold('ShiftLeft')}>Down</button>
            <button className="touch-key touch-boost" {...bindHold('ControlLeft')}>Boost</button>
          </div>
        </div>

        <div
          className="mobile-look-pad"
          onTouchStart={handleLookStart}
          onTouchMove={handleLookMove}
          onTouchEnd={handleLookEnd}
          onTouchCancel={handleLookEnd}
        >
          <span>Steer</span>
        </div>
      </div>
    </div>
  );
}

function PilotAssistPanel({ freeFly, isMobile }) {
  return (
    <div className={`pilot-assist-panel ${freeFly ? 'active' : ''} ${isMobile ? 'mobile' : ''}`}>
      <span className="pilot-assist-kicker">Pilot assist</span>
      <strong>{freeFly ? 'Flight controls active' : 'Observer mode active'}</strong>
      <p>
        {isMobile
          ? 'Tap Pilot, then use the touch thrusters and steer pad.'
          : 'Tap Pilot, then drag to steer and use W A S D with Space, Shift, and Ctrl.'}
      </p>
    </div>
  );
}

function CinematicIntro({ visible }) {
  if (!visible) return null;
  return (
    <div className="cinematic-intro">
      <div className="cinematic-scan" />
      <div className="cinematic-copy">
        <p>T-Central Web Game</p>
        <h2>Initializing navigation systems…</h2>
      </div>
    </div>
  );
}

function SystemOverlay({ loading, mode, freeFly }) {
  return (
    <div className="system-overlay minimal">
      <div className="overlay-status">
        <span>
          {loading ? 'Loading status layer…' : mode === 'remote' ? 'Live status layer connected' : 'Status layer ready — source not configured'}
          {freeFly ? ' • Pilot Mode active' : ''}
        </span>
      </div>
    </div>
  );
}

export default function SystemScene({ lobbyMode = 'hub', steamUser: externalSteamUser = null, onSelectionChange = null }) {
  const router = useRouter();
  const [statuses, setStatuses] = useState({});
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('unconfigured');
  const [transition, setTransition] = useState(null);
  const [resetTick, setResetTick] = useState(0);
  const [freeFly, setFreeFly] = useState(false);
  const [freeplayMode, setFreeplayMode] = useState(false);
  const [flightStats, setFlightStats] = useState({ ...DEFAULT_FLIGHT_STATS });
  const [introVisible, setIntroVisible] = useState(true);
  const [activeInterior, setActiveInterior] = useState(null);
  const [steamUser, setSteamUser] = useState(externalSteamUser);
  const [remotePlayers, setRemotePlayers] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [reducedScene, setReducedScene] = useState(false);

  const safeFlightStats = normalizeFlightStats(flightStats);

  useEffect(() => {
    onSelectionChange?.(selected || null);
  }, [selected, onSelectionChange]);

  useEffect(() => {
    const updateMobile = () => {
      const mobile = isMobileViewport(window.innerWidth) || ('ontouchstart' in window);
      setIsMobile(mobile);
      setReducedScene(mobile || shouldReduceScene(window.innerWidth));
    };
    updateMobile();
    window.addEventListener('resize', updateMobile);
    return () => window.removeEventListener('resize', updateMobile);
  }, []);

  useEffect(() => {
    setSteamUser(externalSteamUser || null);
  }, [externalSteamUser]);

  useEffect(() => {
    if (externalSteamUser?.steamid) return;
    let active = true;

    fetch('/api/auth/steam/session', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setSteamUser(data?.authenticated ? data.user : null);
      })
      .catch(() => {
        if (!active) return;
        setSteamUser(null);
      });

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/live-status', { cache: 'no-store' });
        const data = await res.json();
        if (!active) return;
        setStatuses(data.statuses || {});
        setMode(data.mode || 'unconfigured');
      } catch {
        if (!active) return;
        setMode('error');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchStatus();
    const id = setInterval(fetchStatus, SYSTEM_RUNTIME.statusRefreshMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);


  useEffect(() => {
    if (lobbyMode !== 'hub') {
      setRemotePlayers([]);
      return;
    }

    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch {
      setRemotePlayers([]);
      return;
    }
    if (!supabase || !steamUser?.steamid) return;

    const room = SYSTEM_RUNTIME.roomName;
    const channel = supabase.channel(`webgame:${room}`, {
      config: { presence: { key: steamUser.steamid }, broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'player-state' }, ({ payload }) => {
        if (!payload?.steamid || payload.steamid === steamUser.steamid) return;
        setRemotePlayers((prev) => {
          const next = prev.filter((entry) => entry.steamid !== payload.steamid);
          next.push(payload);
          return next.slice(-100);
        });
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        await channel.track({
          steamid: steamUser.steamid,
          personaname: steamUser.personaname || 'Steam user',
          avatar: steamUser.avatar || null,
          joinedAt: new Date().toISOString(),
        });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [steamUser, lobbyMode]);

  useEffect(() => {
    if (lobbyMode !== 'hub') return;

    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch {
      return;
    }
    const safePosition = getSafePosition(safeFlightStats);
    if (!supabase || !steamUser?.steamid || !Array.isArray(safePosition)) return;

    const room = SYSTEM_RUNTIME.roomName;
    const channel = supabase.channel(`webgame:${room}`, {
      config: { broadcast: { self: false } },
    });

    let timer = null;
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      timer = window.setInterval(() => {
        channel.send({
          type: 'broadcast',
          event: 'player-state',
          payload: {
            steamid: steamUser.steamid,
            personaname: steamUser.personaname || 'Steam user',
            avatar: steamUser.avatar || null,
            position: flightStats.position,
            mode: safeFlightStats.mode || (freeFly ? 'pilot' : 'spectate'),
            zone: safeFlightStats.zone || 'Navigation',
            updatedAt: Date.now(),
          },
        });
      }, SYSTEM_RUNTIME.playerBroadcastMs);
    });

    return () => {
      if (timer) window.clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [steamUser, flightStats, freeFly, lobbyMode]);

  const executeWarp = (item) => {
    const href = item.route || item.href;
    if (!href) return;
    setTransition(item.label);
    setTimeout(() => {
      if (item.external) {
        window.open(href, '_blank', 'noopener,noreferrer');
      } else {
        router.push(href);
      }
    }, 900);
  };

  const openNode = (item) => {
    if (!item) return;
    const href = item.route || item.href;
    if (!href) return;
    if (item.key === 'arma3') {
      setActiveInterior('arma3');
      setSelected(item);
      return;
    }
    executeWarp(item);
  };



  const handleInteriorClose = () => {
    setActiveInterior(null);
  };


  const handleCenter = () => {
    setSelected({
      label: 'System Center',
      address: 'Navigation origin',
      description: `Centered back into the ${lobbyMode === 'hub' ? 'shared multiplayer hub' : 'private Steam-scoped world'}. Select one of the 5 blackholes, 3 Dyson spheres, or the solar system to continue through the world layout.`,
    });
    setResetTick((n) => n + 1);
  };

  const handlePilotToggle = () => {
    const nextFreeFly = !freeFly;
    setFreeFly(nextFreeFly);
    if (!nextFreeFly) setFreeplayMode(false);
    setSelected({
      label: freeFly ? 'Observer Mode' : 'Pilot Mode',
      address: freeFly ? 'Ship hidden' : 'Ship active',
      description: freeFly
        ? 'Returned to observer mode. You can continue spectating the shared system.'
        : isMobile
          ? 'Pilot mode engaged. Use the touch thrusters and steer pad.'
          : 'Pilot mode engaged. Use W A S D, arrows, mouse drag, Space/Shift (or R/F), Ctrl boost, and Q / E.',
    });
  };

  const handleFreeplayToggle = () => {
    if (!freeFly) return;
    const next = !freeplayMode;
    setFreeplayMode(next);
    setSelected({
      label: next ? 'Freeplay Mode' : 'Pilot Mode',
      address: next ? 'Unrestricted flight profile' : 'Standard flight profile',
      description: next
        ? 'Freeplay movement enabled with higher speed, softer damping, and no anchor gravity pull.'
        : 'Standard pilot profile restored with normal pull lanes around anchor objects.',
    });
  };

  return (
    <div className="system-page refined">
      <CinematicIntro visible={introVisible} />
      <SteamIdentityPanel />
      <SystemOverlay loading={loading} mode={mode} freeFly={freeFly} />
      <PilotAssistPanel freeFly={freeFly} isMobile={isMobile} />
      {lobbyMode === 'private' ? <div className="private-world-banner">Private world key: {getPrivateWorldKey(steamUser?.steamid)}</div> : null}
      <RoomPulse freeFly={freeFly} remotePlayers={remotePlayers} />
      <CockpitOverlay freeFly={freeFly} flightStats={safeFlightStats} selected={selected} />
      <FixedNav
        onCenter={handleCenter}
        onPilotToggle={handlePilotToggle}
        freeFly={freeFly}
        freeplayMode={freeplayMode}
        onFreeplayToggle={handleFreeplayToggle}
      />
      <MobilePilotControls visible={freeFly && isMobile} />
      <div className="interactive-map-stage full refined-stage">
        <div className="cosmic-overlay" />
        <Canvas dpr={[1, 1.5]} performance={{ min: 0.5 }} camera={{ position: [0, 2.4, 36], fov: 40 }} gl={{ antialias: !isMobile, powerPreference: 'high-performance' }}>
          <Scene
            statuses={statuses}
            onSelect={setSelected}
            resetTick={resetTick}
            freeFly={freeFly}
            freeplayMode={freeplayMode}
            onFlightStats={(next) => setFlightStats(normalizeFlightStats(next))}
            remotePlayers={remotePlayers}
            reducedScene={reducedScene}
            isMobile={isMobile}
            onIntroDone={() => setIntroVisible(false)}
          />
        </Canvas>
        <ServerRoutePanel selected={selected} />
        <RoomObjectives />
        <FocusPanel item={selected} statuses={statuses} onClose={() => setSelected(null)} onOpen={openNode} />
        <Arma3BlackholeInterior
          item={activeInterior === 'arma3' ? selected : null}
          statuses={statuses}



          onClose={handleInteriorClose}
        />
        {transition ? <WarpOverlay label={transition} /> : null}
      </div>
    </div>
  );
}
