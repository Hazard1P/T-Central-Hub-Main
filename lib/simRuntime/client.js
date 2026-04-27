import * as THREE from 'three';
import { clamp } from '@/lib/mathEngine';
import { stepShipState } from '@/lib/physicsEngine';
import { resolveStarSingularity } from '@/lib/singularityEngine';
import { stepFrame } from '@/lib/simCore/stepFrame';
import { createContinuityHeartbeat, SIM_RUNTIME_STATUS } from '@/lib/simRuntime/contracts';

function resolveRuntimeAvailability() {
  if (typeof window === 'undefined') return true;
  if (process.env.NEXT_PUBLIC_SIM_RUNTIME_DISABLED === 'true') return false;
  return !Boolean(window.__TCENTRAL_DISABLE_SIM_RUNTIME__);
}

function vectorToArray(vector = null, fallback = [0, 0, 0]) {
  if (Array.isArray(vector)) return vector;
  if (!vector) return fallback;
  return [vector.x || 0, vector.y || 0, vector.z || 0];
}

function continuitySafeFallbackStep({
  mode = 'singleplayer',
  position = [0, 0, 18],
  velocity = [0, 0, 0],
  controlVector = [0, 0, 0],
  dt = 1 / 60,
  simulationSeed = 'tcentral-main',
  frameIndex = 0,
}) {
  const safeDt = clamp(dt, 1 / 120, 1 / 20);
  const dampedVelocity = velocity.map((value) => Number((value * 0.92).toFixed(4)));
  const boundedControl = controlVector.map((value) => clamp(value, -2.4, 2.4));
  const assistedVelocity = dampedVelocity.map((value, index) => value + boundedControl[index] * safeDt * 1.8);
  const nextPosition = position.map((value, index) => Number((value + assistedVelocity[index] * safeDt).toFixed(4)));
  const speed = Math.hypot(...assistedVelocity);
  const heartbeat = createContinuityHeartbeat({
    snapshot: { simulationSeed, frameIndex, dt: safeDt, position: nextPosition, velocity: assistedVelocity, controlVector: boundedControl },
    runtimeStatus: SIM_RUNTIME_STATUS.DEGRADED,
    degradedReason: `sim-runtime-unavailable:${mode}`,
  });
  return {
    mode,
    position: nextPosition,
    velocity: assistedVelocity,
    speed,
    gravityMagnitude: 0,
    nearest: null,
    horizon: null,
    runtimeStatus: SIM_RUNTIME_STATUS.DEGRADED,
    degradedReason: `sim-runtime-unavailable:${mode}`,
    heartbeat,
  };
}

export function createSimulationRuntimeClient() {
  return {
    isAvailable() {
      return resolveRuntimeAvailability();
    },

    stepSnapshot(payload = {}) {
      const {
        mode = 'singleplayer',
        frameIndex = 0,
        simulationSeed = 'tcentral-main',
        dt = 1 / 60,
      } = payload;

      if (!resolveRuntimeAvailability()) {
        return continuitySafeFallbackStep({ ...payload, mode, frameIndex, simulationSeed, dt });
      }

      if (mode === 'multiplayer') {
        const stepped = stepFrame({
          position: payload.position || [0, 0, 18],
          velocity: payload.velocity || [0, 0, 0],
          controlVector: payload.controlVector || [0, 0, 0],
          dt,
          worldSeed: simulationSeed,
          gravitySources: payload.gravitySources || [],
          profile: 'multiplayer',
        });
        const speed = Math.hypot(...(stepped.velocity || [0, 0, 0]));
        const heartbeat = createContinuityHeartbeat({
          snapshot: { simulationSeed, frameIndex, dt, position: stepped.position, velocity: stepped.velocity, controlVector: payload.controlVector || [0, 0, 0] },
          runtimeStatus: SIM_RUNTIME_STATUS.ONLINE,
        });
        return {
          mode,
          position: stepped.position,
          velocity: stepped.velocity,
          speed,
          gravityMagnitude: Math.hypot(...(stepped.gravity || [0, 0, 0])),
          nearest: null,
          horizon: null,
          runtimeStatus: SIM_RUNTIME_STATUS.ONLINE,
          degradedReason: null,
          heartbeat,
        };
      }

      const stepped = stepShipState({
        position: payload.positionVector || new THREE.Vector3(...(payload.position || [0, 0, 18])),
        velocity: payload.velocityVector || new THREE.Vector3(...(payload.velocity || [0, 0, 0])),
        inputVector: payload.inputVector || new THREE.Vector3(...(payload.controlVector || [0, 0, 0])),
        gravitySources: payload.gravitySources || [],
        isMobile: Boolean(payload.isMobile),
        dt,
      });
      const position = vectorToArray(stepped.position);
      const velocity = vectorToArray(stepped.velocity);
      const nearest = stepped.gravitySample?.diagnostics?.[0] || null;
      const gravityMagnitude = stepped.gravitySample?.acceleration?.length?.() || 0;
      const heartbeat = createContinuityHeartbeat({
        snapshot: { simulationSeed, frameIndex, dt, position, velocity, controlVector: payload.controlVector || [0, 0, 0] },
        runtimeStatus: SIM_RUNTIME_STATUS.ONLINE,
      });
      return {
        mode,
        position,
        velocity,
        speed: stepped.speed || Math.hypot(...velocity),
        gravityMagnitude,
        nearest,
        horizon: stepped.horizon || null,
        runtimeStatus: SIM_RUNTIME_STATUS.ONLINE,
        degradedReason: null,
        heartbeat,
      };
    },

    replayAuthoritativeState({ frames = [], authoritativePosition = [0, 0, 18], authoritativeVelocity = [0, 0, 0], simulationSeed = 'tcentral-main', gravitySources = [] } = {}) {
      if (!resolveRuntimeAvailability()) return { position: authoritativePosition, velocity: authoritativeVelocity };
      return frames.reduce((acc, frame) => stepFrame({
        position: acc.position,
        velocity: acc.velocity,
        controlVector: frame.controlVector,
        dt: frame.dt,
        worldSeed: simulationSeed,
        gravitySources,
        profile: 'multiplayer',
      }), {
        position: authoritativePosition,
        velocity: authoritativeVelocity,
      });
    },

    resolveSingularitySnapshot(payload = {}) {
      if (!resolveRuntimeAvailability()) {
        const heartbeat = createContinuityHeartbeat({
          snapshot: {
            simulationSeed: payload.simulationSeed || 'tcentral-main',
            frameIndex: payload.frameIndex || 0,
            position: payload.position || [0, 0, 0],
            velocity: payload.velocity || [0, 0, 0],
            controlVector: payload.controlVector || [0, 0, 0],
            dt: payload.dt || 1 / 60,
          },
          runtimeStatus: SIM_RUNTIME_STATUS.DEGRADED,
          degradedReason: 'sim-runtime-unavailable:singularity',
        });
        return {
          singularity: resolveStarSingularity(payload),
          runtimeStatus: SIM_RUNTIME_STATUS.DEGRADED,
          degradedReason: 'sim-runtime-unavailable:singularity',
          heartbeat,
        };
      }
      const heartbeat = createContinuityHeartbeat({
        snapshot: {
          simulationSeed: payload.simulationSeed || 'tcentral-main',
          frameIndex: payload.frameIndex || 0,
          position: payload.position || [0, 0, 0],
          velocity: payload.velocity || [0, 0, 0],
          controlVector: payload.controlVector || [0, 0, 0],
          dt: payload.dt || 1 / 60,
        },
        runtimeStatus: SIM_RUNTIME_STATUS.ONLINE,
      });
      return {
        singularity: resolveStarSingularity(payload),
        runtimeStatus: SIM_RUNTIME_STATUS.ONLINE,
        degradedReason: null,
        heartbeat,
      };
    },
  };
}

