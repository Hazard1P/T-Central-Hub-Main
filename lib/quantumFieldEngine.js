import { clamp, lerp, projectNDToColor, smoothstep, TAU } from '@/lib/mathEngine';
import { createSpinState, measureAndCollapseSpinState, computeSpinObservables } from '@/lib/spinStateEngine';
import {
  HYPERSPACE_DIMENSIONS,
  DEFAULT_HYPERSPACE_SIGNATURE,
  formatHyperspaceSignature,
  normalizeHyperspaceSignature,
} from '@/lib/simulationConfig';

export const QUANTUM_DIMENSIONS = HYPERSPACE_DIMENSIONS;

function createAmplitudeVector(seed = 0, spinObservables = null) {
  const amplitudes = Array.from({ length: QUANTUM_DIMENSIONS.length }, (_, index) => Math.sin(seed + index * 0.73) * 0.25);
  if (spinObservables) {
    amplitudes[0] = spinObservables.projections['1/2'].plus;
    amplitudes[1] = spinObservables.projections['1/2'].minus;
    amplitudes[2] = spinObservables.projections['1/4'].plus;
    amplitudes[3] = spinObservables.projections['1/4'].minus;
  }
  return amplitudes;
}

export function createQuantumState(seed = 0) {
  const spin = createSpinState(seed);
  const spinObservables = computeSpinObservables(spin);

  return {
    phase: seed * 0.17,
    amplitudes: createAmplitudeVector(seed, spinObservables),
    coherence: 0.88,
    entropy: 0.12,
    probabilityDensity: 0.6,
    spin,
    spinObservables,
    spinMeasurement: null,
    hue: '#9fdcff',
    signature: DEFAULT_HYPERSPACE_SIGNATURE,
  };
}

export function evolveQuantumState({ prevState, dt, speed, gravityMagnitude, horizonFactor, authenticated, nearestKey }) {
  const nextPhase = (prevState.phase + dt * (0.4 + speed * 0.015 + gravityMagnitude * 0.01)) % TAU;
  const coherenceTarget = clamp(1 - horizonFactor * 0.72 + (authenticated ? 0.08 : -0.02), 0.12, 1);
  const entropyTarget = clamp(0.14 + horizonFactor * 0.62 + speed * 0.015, 0.05, 0.95);

  const { spinState, observables, measurement } = measureAndCollapseSpinState({
    spinState: prevState.spin,
    gravityMagnitude,
    horizonFactor,
    speed,
    dt,
  });

  const probabilityDensity = clamp(
    0.5
      + Math.sin(nextPhase) * 0.1
      + gravityMagnitude * 0.008
      + observables.polarization * 0.08
      - measurement.decoherence * 0.35,
    0.08,
    0.98,
  );

  const amplitudes = prevState.amplitudes.map((value, index) => {
    const harmonic = Math.sin(nextPhase * (1 + index * 0.08) + index * 0.37);
    const coupling = gravityMagnitude * (0.006 + index * 0.0009);
    const damping = horizonFactor * (0.012 + index * 0.0006);
    return clamp(value * (1 - damping) + harmonic * 0.028 + coupling - prevState.entropy * 0.008, -1, 1);
  });

  amplitudes[0] = observables.projections['1/2'].plus;
  amplitudes[1] = observables.projections['1/2'].minus;
  amplitudes[2] = observables.projections['1/4'].plus;
  amplitudes[3] = observables.projections['1/4'].minus;

  const coherence = lerp(prevState.coherence, coherenceTarget * (0.9 + observables.stability * 0.1), 0.12);
  const entropy = lerp(prevState.entropy, entropyTarget + measurement.decoherence * 0.12, 0.08);
  const spectral = projectNDToColor(amplitudes.slice(0, QUANTUM_DIMENSIONS.length));

  return {
    phase: nextPhase,
    amplitudes,
    coherence,
    entropy,
    probabilityDensity,
    spin: spinState,
    spinObservables: observables,
    spinMeasurement: measurement,
    hue: `#${spectral.getHexString()}`,
    signature: normalizeHyperspaceSignature(nearestKey ? formatHyperspaceSignature(nearestKey) : DEFAULT_HYPERSPACE_SIGNATURE, DEFAULT_HYPERSPACE_SIGNATURE),
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
    spinPolarization: Number((state.spinObservables?.polarization || 0).toFixed(3)),
    spinStabilityPercent: Math.round((state.spinObservables?.stability || 0) * 100),
    spinHalfProjection: Number((state.spinObservables?.projections?.['1/2']?.signedProjection || 0).toFixed(3)),
    spinQuarterProjection: Number((state.spinObservables?.projections?.['1/4']?.signedProjection || 0).toFixed(3)),
    color: state.hue,
    signature: normalizeHyperspaceSignature(state.signature, DEFAULT_HYPERSPACE_SIGNATURE),
  };
}
