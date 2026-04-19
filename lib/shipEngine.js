import { rk4Integrate, clamp } from '@/lib/mathEngine';
import { sampleUniverseGravity, computeTidalStress } from '@/lib/gravityEngine';

function addVec(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scaleVec(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function length(v) {
  return Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
}

function normalize(v) {
  const len = length(v) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function createShipState() {
  return {
    position: [0, 0.9, 14],
    velocity: [0, 0, 0],
    thrust: [0, 0, 0],
    speed: 0,
    warp: 0,
    stress: 0,
  };
}

export function computeShipControls(input, mode = 'max') {
  const base = mode === 'max' ? 13.5 : 8.5;
  const vertical = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const forward = (input.forward ? -1 : 0) + (input.backward ? 1 : 0);
  const lateral = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const vector = normalize([lateral, vertical * 0.72, forward]);
  const throttle = input.boost ? 1.75 : 1;
  return scaleVec(vector, base * throttle);
}

export function stepShipState({ state, dt, graph, input, mode = 'max' }) {
  const thrust = computeShipControls(input, mode);
  const deriv = (sample) => {
    const gravity = sampleUniverseGravity({ graph, position: sample.position });
    const damping = scaleVec(sample.velocity, mode === 'max' ? -0.055 : -0.08);
    const accel = addVec(addVec(thrust, gravity.acceleration), damping);
    return {
      dPosition: sample.velocity,
      dVelocity: accel,
    };
  };

  const next = rk4Integrate(
    { position: state.position, velocity: state.velocity },
    dt,
    deriv
  );

  const speed = length(next.velocity);
  const stress = computeTidalStress({ graph, position: next.position });
  return {
    ...state,
    position: next.position.map((n) => Number(n.toFixed(4))),
    velocity: next.velocity.map((n) => Number(n.toFixed(4))),
    thrust,
    speed: Number(speed.toFixed(3)),
    warp: clamp(speed / (mode === 'max' ? 24 : 14), 0, 1),
    stress,
  };
}
