import { clamp, lerp } from '@/lib/mathEngine';

export const ALLOWED_SPIN_STATES = Object.freeze([
  { label: '1/2', magnitude: 0.5 },
  { label: '1/4', magnitude: 0.25 },
]);

const BASIS_AXES = Object.freeze(['plus', 'minus']);

function normalizeBasisVector(vector = {}) {
  const plus = Number.isFinite(vector.plus) ? Math.max(0, vector.plus) : 0;
  const minus = Number.isFinite(vector.minus) ? Math.max(0, vector.minus) : 0;
  const sum = plus + minus;

  if (sum <= 0) {
    return { plus: 0.5, minus: 0.5 };
  }

  return { plus: plus / sum, minus: minus / sum };
}

export function normalizeSpinState(state = {}) {
  const normalized = {
    basis: {},
    coherence: clamp(Number.isFinite(state.coherence) ? state.coherence : 0.86, 0.05, 1),
    collapseCount: Number.isFinite(state.collapseCount) ? Math.max(0, Math.round(state.collapseCount)) : 0,
    lastMeasuredAt: Number.isFinite(state.lastMeasuredAt) ? state.lastMeasuredAt : 0,
    lastDriver: state.lastDriver || 'initialized',
  };

  ALLOWED_SPIN_STATES.forEach(({ label }) => {
    normalized.basis[label] = normalizeBasisVector(state.basis?.[label]);
  });

  return normalized;
}

export function createSpinState(seed = 0) {
  const phase = Math.sin(seed * 0.37);
  return normalizeSpinState({
    basis: {
      '1/2': { plus: 0.52 + phase * 0.14, minus: 0.48 - phase * 0.14 },
      '1/4': { plus: 0.5 - phase * 0.11, minus: 0.5 + phase * 0.11 },
    },
    coherence: 0.84,
  });
}

export function computeSpinObservables(spinState = {}) {
  const normalized = normalizeSpinState(spinState);
  const obs = {
    projections: {},
    polarization: 0,
    stability: 0,
  };

  ALLOWED_SPIN_STATES.forEach(({ label, magnitude }) => {
    const basis = normalized.basis[label];
    const signedProjection = (basis.plus - basis.minus) * magnitude;
    obs.projections[label] = {
      plus: basis.plus,
      minus: basis.minus,
      signedProjection,
      absoluteProjection: Math.abs(signedProjection),
    };
  });

  const polarization = ALLOWED_SPIN_STATES.reduce((total, { label, magnitude }) => {
    return total + obs.projections[label].signedProjection * (magnitude / 0.5);
  }, 0);

  obs.polarization = clamp(polarization, -1, 1);
  obs.stability = clamp(normalized.coherence * (1 - Math.abs(obs.polarization) * 0.35), 0, 1);

  return obs;
}

function buildMeasurementBias({ gravityMagnitude = 0, horizonFactor = 0, speed = 0 } = {}) {
  const gravBias = clamp(gravityMagnitude / 22, 0, 1.2);
  const horizonBias = clamp(horizonFactor, 0, 1.1);
  const speedBias = clamp(speed / 20, 0, 1.15);

  return {
    gravBias,
    horizonBias,
    speedBias,
    plusBiasHalf: clamp(0.5 + gravBias * 0.16 - horizonBias * 0.22 - speedBias * 0.05, 0.06, 0.94),
    plusBiasQuarter: clamp(0.5 + speedBias * 0.14 - gravBias * 0.09 - horizonBias * 0.15, 0.08, 0.92),
  };
}

export function measureAndCollapseSpinState({ spinState, gravityMagnitude = 0, horizonFactor = 0, speed = 0, dt = 0.016 } = {}) {
  const normalized = normalizeSpinState(spinState);
  const bias = buildMeasurementBias({ gravityMagnitude, horizonFactor, speed });

  const collapseStrength = clamp(0.08 + bias.horizonBias * 0.28 + bias.gravBias * 0.12 + dt * 0.35, 0.08, 0.62);
  const decoherence = clamp(0.012 + bias.horizonBias * 0.032 + bias.speedBias * 0.015, 0.006, 0.08);

  const nextBasis = {
    '1/2': {
      plus: lerp(normalized.basis['1/2'].plus, bias.plusBiasHalf, collapseStrength),
      minus: lerp(normalized.basis['1/2'].minus, 1 - bias.plusBiasHalf, collapseStrength),
    },
    '1/4': {
      plus: lerp(normalized.basis['1/4'].plus, bias.plusBiasQuarter, collapseStrength * 0.9),
      minus: lerp(normalized.basis['1/4'].minus, 1 - bias.plusBiasQuarter, collapseStrength * 0.9),
    },
  };

  const nextState = normalizeSpinState({
    basis: nextBasis,
    coherence: normalized.coherence * (1 - decoherence),
    collapseCount: normalized.collapseCount + 1,
    lastMeasuredAt: normalized.lastMeasuredAt + dt,
    lastDriver: `g:${gravityMagnitude.toFixed(2)}|h:${horizonFactor.toFixed(2)}|v:${speed.toFixed(2)}`,
  });

  const observables = computeSpinObservables(nextState);

  return {
    spinState: nextState,
    observables,
    measurement: {
      collapseStrength,
      decoherence,
      inputs: { gravityMagnitude, horizonFactor, speed },
      schema: {
        basisStates: ALLOWED_SPIN_STATES.map(({ label }) => label),
        basisAxes: BASIS_AXES,
      },
    },
  };
}
