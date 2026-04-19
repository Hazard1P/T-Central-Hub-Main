import { clamp, lerp, project12DToColor, smoothstep, TAU } from '@/lib/mathEngine';

export const QUANTUM_DIMENSIONS = [
  'spin',
  'phase',
  'coherence',
  'entanglement',
  'curvature',
  'inertia',
  'graviton',
  'horizon',
  'flux',
  'topology',
  'lensing',
  'navigation',
];

export function createQuantumState(seed = 0) {
  return {
    phase: seed * 0.17,
    amplitudes: Array.from({ length: QUANTUM_DIMENSIONS.length }, (_, index) => Math.sin(seed + index * 0.73) * 0.25),
    coherence: 0.88,
    entropy: 0.12,
    probabilityDensity: 0.6,
    hue: '#9fdcff',
    signature: 'Q12D-Observer',
  };
}

export function evolveQuantumState({ prevState, dt, speed, gravityMagnitude, horizonFactor, authenticated, nearestKey }) {
  const nextPhase = (prevState.phase + dt * (0.4 + speed * 0.015 + gravityMagnitude * 0.01)) % TAU;
  const coherenceTarget = clamp(1 - horizonFactor * 0.72 + (authenticated ? 0.08 : -0.02), 0.12, 1);
  const entropyTarget = clamp(0.14 + horizonFactor * 0.62 + speed * 0.015, 0.05, 0.95);
  const probabilityDensity = clamp(0.5 + Math.sin(nextPhase) * 0.18 + gravityMagnitude * 0.01, 0.08, 0.98);

  const amplitudes = prevState.amplitudes.map((value, index) => {
    const harmonic = Math.sin(nextPhase * (1 + index * 0.08) + index * 0.37);
    const coupling = gravityMagnitude * (0.006 + index * 0.0009);
    const damping = horizonFactor * (0.012 + index * 0.0006);
    return clamp(value * (1 - damping) + harmonic * 0.028 + coupling - prevState.entropy * 0.008, -1, 1);
  });

  const coherence = lerp(prevState.coherence, coherenceTarget, 0.12);
  const entropy = lerp(prevState.entropy, entropyTarget, 0.08);
  const spectral = project12DToColor(amplitudes);

  return {
    phase: nextPhase,
    amplitudes,
    coherence,
    entropy,
    probabilityDensity,
    hue: `#${spectral.getHexString()}`,
    signature: nearestKey ? `Q12D-${nearestKey}` : 'Q12D-Observer',
  };
}

export function summarizeQuantumState(state) {
  const dominantIndex = state.amplitudes.reduce(
    (best, value, index) => (Math.abs(value) > Math.abs(state.amplitudes[best]) ? index : best),
    0,
  );

  return {
    dominantDimension: QUANTUM_DIMENSIONS[dominantIndex],
    coherencePercent: Math.round(state.coherence * 100),
    entropyPercent: Math.round(state.entropy * 100),
    probabilityPercent: Math.round(state.probabilityDensity * 100),
    horizonStress: Math.round(smoothstep(0.2, 0.95, state.entropy) * 100),
    color: state.hue,
    signature: state.signature,
  };
}
