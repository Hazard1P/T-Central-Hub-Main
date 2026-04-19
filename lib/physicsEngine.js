import * as THREE from 'three';
import { clamp, gaussian, inverseSquareFalloff, normalizeVectorSafe, rk4IntegrateVector, smoothstep } from '@/lib/mathEngine';

export const PHYSICS_CONSTANTS = {
  G: 18.5,
  c: 22,
  shipMass: 1,
  thrustDesktop: 9.2,
  thrustMobile: 7.1,
  drag: 0.06,
  angularDamping: 0.12,
  maxSpeed: 20,
  worldBounds: {
    x: [-60, 60],
    y: [-28, 28],
    z: [-50, 50],
  },
};

export function getBodyMass(node) {
  if (!node) return 0;
  if (node.kind === 'blackhole') return node.mass ?? 440;
  if (node.kind === 'solar') return node.mass ?? 190;
  if (node.kind === 'dyson') return node.mass ?? 125;
  return node.mass ?? 18;
}

export function getSchwarzschildRadius(mass) {
  return (2 * PHYSICS_CONSTANTS.G * mass) / (PHYSICS_CONSTANTS.c * PHYSICS_CONSTANTS.c);
}

export function createGravitySources(nodes = []) {
  return nodes.map((node) => {
    const mass = getBodyMass(node);
    const radius = node.radius || 1;
    const schwarzschildRadius = getSchwarzschildRadius(mass);
    const eventHorizonRadius = node.kind === 'blackhole'
      ? Math.max(radius * 0.86, schwarzschildRadius * 0.32)
      : radius * 0.5;

    return {
      ...node,
      mass,
      radius,
      schwarzschildRadius,
      eventHorizonRadius,
      influenceRadius: node.kind === 'blackhole' ? 22 : node.kind === 'solar' ? 17 : 12,
    };
  });
}

export function sampleGravityAt(position, sources = []) {
  const total = new THREE.Vector3();
  const diagnostics = [];

  sources.forEach((source) => {
    const sourcePosition = new THREE.Vector3(...source.position);
    const delta = sourcePosition.clone().sub(position);
    const distance = Math.max(delta.length(), source.eventHorizonRadius * 0.8 + 0.4);
    const direction = normalizeVectorSafe(delta);
    const strength = PHYSICS_CONSTANTS.G * source.mass * inverseSquareFalloff(distance, 2, 0.3);
    const radial = direction.multiplyScalar(strength);
    total.add(radial);

    diagnostics.push({
      key: source.key,
      distance,
      strength,
      tidal: strength / Math.max(distance, 0.5),
      escapeVelocity: Math.sqrt(Math.max((2 * PHYSICS_CONSTANTS.G * source.mass) / distance, 0)),
      horizonFactor: smoothstep(source.eventHorizonRadius * 3, source.eventHorizonRadius * 1.05, distance),
      source,
    });
  });

  diagnostics.sort((a, b) => a.distance - b.distance);
  return { acceleration: total, diagnostics };
}

export function computeEventHorizonMetrics(position, sources = []) {
  const nearest = sources
    .map((source) => {
      const distance = position.distanceTo(new THREE.Vector3(...source.position));
      const radialDistance = Math.max(distance - source.eventHorizonRadius, 0);
      const lensing = gaussian(radialDistance / Math.max(source.eventHorizonRadius * 3.2, 1), 0.8);
      return {
        key: source.key,
        kind: source.kind,
        distance,
        radialDistance,
        eventHorizonRadius: source.eventHorizonRadius,
        lensing,
        insideHorizon: source.kind === 'blackhole' && distance <= source.eventHorizonRadius,
      };
    })
    .sort((a, b) => a.distance - b.distance)[0] || null;

  return nearest;
}

export function stepShipState({ position, velocity, inputVector, gravitySources, isMobile = false, dt }) {
  const thrustStrength = isMobile ? PHYSICS_CONSTANTS.thrustMobile : PHYSICS_CONSTANTS.thrustDesktop;
  const thrustVector = inputVector.clone();
  if (thrustVector.lengthSq() > 1) thrustVector.normalize();
  thrustVector.multiplyScalar(thrustStrength);

  const accelerationFn = (samplePosition, sampleVelocity) => {
    const gravity = sampleGravityAt(samplePosition, gravitySources).acceleration;
    const drag = sampleVelocity.clone().multiplyScalar(-PHYSICS_CONSTANTS.drag * (1 + sampleVelocity.length() * 0.04));
    return gravity.add(thrustVector).add(drag);
  };

  const next = rk4IntegrateVector(position, velocity, dt, accelerationFn);
  if (next.velocity.length() > PHYSICS_CONSTANTS.maxSpeed) {
    next.velocity.setLength(PHYSICS_CONSTANTS.maxSpeed);
  }

  next.position.x = clamp(next.position.x, ...PHYSICS_CONSTANTS.worldBounds.x);
  next.position.y = clamp(next.position.y, ...PHYSICS_CONSTANTS.worldBounds.y);
  next.position.z = clamp(next.position.z, ...PHYSICS_CONSTANTS.worldBounds.z);

  const gravitySample = sampleGravityAt(next.position, gravitySources);
  const horizon = computeEventHorizonMetrics(next.position, gravitySources);

  return {
    ...next,
    gravitySample,
    horizon,
    speed: next.velocity.length(),
  };
}


export function sampleGravityField({ position, sources = [] }) {
  const vector = Array.isArray(position) ? new THREE.Vector3(...position) : position.clone();
  const normalizedSources = sources.map((source) => ({
    ...source,
    eventHorizonRadius: source.eventHorizonRadius || Math.max((source.radius || 1) * 0.8, 0.5),
    influenceRadius: source.influenceRadius || (source.kind === 'blackhole' ? 22 : source.kind === 'solar' ? 17 : 12),
  }));
  const sample = sampleGravityAt(vector, normalizedSources);
  const horizon = computeEventHorizonMetrics(vector, normalizedSources);
  return {
    acceleration: [sample.acceleration.x, sample.acceleration.y, sample.acceleration.z],
    magnitude: Number(sample.acceleration.length().toFixed(4)),
    diagnostics: sample.diagnostics,
    horizonStress: Number((horizon?.lensing || 0).toFixed(4)),
    horizon,
  };
}
