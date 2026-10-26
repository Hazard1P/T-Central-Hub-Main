import * as THREE from "three";
import { celestialMetrics } from "./celestialScale.js";
import {
  sampleField,
  horizonMetrics,
  LIGHT_SPEED,
  GAME_GRAVITY_CONSTANT,
  schwarzschildRadius,
} from "./physics/mechanics.js";
import { createPhysicsFrame } from "./physics/world.js";
import { WORLD_LIMIT, MAX_FLIGHT_SPEED } from "./universeSpace.js";
import { SIM_TUNING_PROFILES, stepFrame } from "./simCore/stepFrame.js";
import {
  WORLD_SUB_SECTOR_ASSETS,
  getWorldMapAssetByKey,
} from "./worldLayout.js";

// Compatibility facade for scene/graph callers. Forces and integration are
// implemented in lib/physics and simCore, using the same world units as flight.
export const PHYSICS_CONSTANTS = {
  G: GAME_GRAVITY_CONSTANT,
  c: LIGHT_SPEED,
  shipMass: 1,
  thrustDesktop: SIM_TUNING_PROFILES.multiplayer.thrust,
  thrustMobile: SIM_TUNING_PROFILES.multiplayer.thrust,
  drag: 0,
  angularDamping: 0.12,
  maxSpeed: MAX_FLIGHT_SPEED,
  worldBounds: {
    x: [-WORLD_LIMIT, WORLD_LIMIT],
    y: [-WORLD_LIMIT, WORLD_LIMIT],
    z: [-WORLD_LIMIT, WORLD_LIMIT],
  },
};

export const FLIGHT_TUNING_PROFILES = {
  singleplayer: SIM_TUNING_PROFILES.singleplayer,
  multiplayer: SIM_TUNING_PROFILES.multiplayer,
};

export function getBodyMass(node) {
  if (!node) return 0;
  if (node.kind === "blackhole") return node.mass ?? 440;
  if (node.kind === "solar") return node.mass ?? 190;
  if (node.kind === "dyson") return node.mass ?? 125;
  return node.mass ?? 18;
}

export function getSchwarzschildRadius(mass) {
  return schwarzschildRadius(PHYSICS_CONSTANTS.G * mass);
}

export function createGravitySources(nodes = [], options = {}) {
  const subSectorAssets = Array.isArray(options.subSectorAssets)
    ? options.subSectorAssets
    : WORLD_SUB_SECTOR_ASSETS;
  return nodes.map((node) => {
    const subSectorAsset = getWorldMapAssetByKey(node?.key, subSectorAssets);
    const anchoredPosition = Array.isArray(subSectorAsset?.physicsPosition)
      ? [...subSectorAsset.physicsPosition]
      : Array.isArray(node?.position)
        ? [...node.position]
        : [0, 0, 0];
    const mass = getBodyMass(node);
    const metrics = celestialMetrics(node);
    const radius = metrics.radius;
    const schwarzschildRadius = getSchwarzschildRadius(mass);
    const eventHorizonRadius =
      node.kind === "blackhole" ? radius : radius * 0.5;

    return {
      ...node,
      position: anchoredPosition,
      mapAnchorKey: subSectorAsset?.anchorKey || node?.mapAnchorKey || null,
      subSectorAssetKey:
        subSectorAsset?.subSectorKey || node?.subSectorAssetKey || null,
      mapPosition: subSectorAsset?.mapPosition || node?.mapPosition || null,
      offsetFromAnchor:
        subSectorAsset?.offsetFromAnchor || node?.offsetFromAnchor || null,
      mass,
      radius,
      schwarzschildRadius,
      eventHorizonRadius,
      influenceRadius: metrics.clearanceRadius * 2,
    };
  });
}

export function sampleGravityAt(position, sources = [], utcMs = Date.now()) {
  const input = Array.isArray(position) ? position : position.toArray();
  const frame = createPhysicsFrame({ utcMs, gravitySources: sources });
  const sample = sampleField(input, frame.sources, { diagnostics: true });
  return { ...sample, acceleration: new THREE.Vector3(...sample.acceleration) };
}

export function computeEventHorizonMetrics(position, sources = []) {
  return horizonMetrics(
    Array.isArray(position) ? position : position.toArray(),
    sources,
  );
}

export function stepShipState({
  position,
  velocity,
  inputVector,
  gravitySources = [],
  dt,
  utcMs = Date.now(),
}) {
  const result = stepFrame({
    position: position.toArray(),
    velocity: velocity.toArray(),
    controlVector: inputVector.toArray(),
    gravitySources,
    dt,
    utcMs,
  });
  const sample = sampleField(result.position, result.sources, {
    diagnostics: true,
    velocity: result.velocity,
  });
  return {
    ...result,
    position: new THREE.Vector3(...result.position),
    velocity: new THREE.Vector3(...result.velocity),
    gravitySample: {
      ...sample,
      acceleration: new THREE.Vector3(...sample.acceleration),
    },
    speed: Math.hypot(...result.velocity),
  };
}

export function sampleGravityField({
  position,
  sources = [],
  utcMs = Date.now(),
}) {
  const vector = Array.isArray(position) ? position : position.toArray();
  const frame = createPhysicsFrame({ utcMs, gravitySources: sources });
  const sample = sampleField(vector, frame.sources, { diagnostics: true });
  const horizon = horizonMetrics(vector, frame.sources);
  return {
    ...sample,
    magnitude: Math.hypot(...sample.acceleration),
    horizonStress: horizon?.lensing || 0,
    horizon,
  };
}
