import { clamp, lerp } from '@/lib/mathEngine';

export function resolveStarSingularity({
  gravity = 0,
  horizonFactor = 0,
  coherencePercent = 50,
  entropyPercent = 50,
  speed = 0,
  epochPhase = 0.5,
  spinPolarization = 0,
  spinStabilityPercent = 50,
  spinHalfProjection = 0,
  spinQuarterProjection = 0,
  nearestKey = 'deep_blackhole',
} = {}) {
  const coherence = clamp(coherencePercent / 100, 0, 1.2);
  const entropy = clamp(entropyPercent / 100, 0, 1.4);
  const graviticPressure = clamp(gravity / 24, 0, 1.6);
  const velocityShear = clamp(speed / 18, 0, 1.2);
  const horizonStress = clamp(horizonFactor, 0, 1.2);
  const spinStability = clamp(spinStabilityPercent / 100, 0, 1);
  const normalizedSpinHalf = clamp((spinHalfProjection + 0.5) / 1, 0, 1);
  const normalizedSpinQuarter = clamp((spinQuarterProjection + 0.25) / 0.5, 0, 1);
  const spinPolar = clamp(spinPolarization, -1, 1);

  const epochResonance = 0.72 + Math.sin(epochPhase * Math.PI * 2) * 0.18;

  // Unit comments:
  // spinAlignmentTerm: dimensionless alignment weight derived from projected spin basis states [unitless].
  const spinAlignmentTerm = clamp(normalizedSpinHalf * 0.62 + normalizedSpinQuarter * 0.38, 0, 1);
  // spinContainmentTerm: stabilization contribution from coherent spin observables [unitless].
  const spinContainmentTerm = clamp(spinStability * 0.65 + spinAlignmentTerm * 0.35, 0, 1);
  // spinShearPenalty: destabilization caused by polarized spin shear under horizon stress [unitless].
  const spinShearPenalty = clamp(Math.abs(spinPolar) * (0.34 + horizonStress * 0.2), 0, 0.9);

  const containment = clamp(
    (coherence * 0.54 + epochResonance * 0.22 + entropy * 0.16 + spinContainmentTerm * 0.22) - horizonStress * 0.28,
    0.08,
    1.24,
  );

  const singularityIndex = clamp(
    graviticPressure * 0.31 + horizonStress * 0.28 + velocityShear * 0.15 + entropy * 0.17 + spinShearPenalty * 0.21,
    0,
    1.4,
  );

  // resolvedWindow = 1 - |S_idx - C_s| + spinContainmentTerm*0.08 - spinShearPenalty*0.06 [unitless].
  const resolvedWindow = clamp(
    1 - Math.abs(singularityIndex - containment) + spinContainmentTerm * 0.08 - spinShearPenalty * 0.06,
    0,
    1,
  );
  const starTerm = lerp(0.88, 1.42, resolvedWindow);

  return {
    nearestKey,
    containment: Number(containment.toFixed(3)),
    singularityIndex: Number(singularityIndex.toFixed(3)),
    resolvedWindow: Number(resolvedWindow.toFixed(3)),
    starTerm: Number(starTerm.toFixed(3)),
    resolved: resolvedWindow >= 0.52,
    equation: 'Σ★ = (G_p + H_s + V_s + E_q + P_spin) - (C_s + Ω_spin)',
    equationTerms: {
      G_p: 'Gravitic pressure [unitless]',
      H_s: 'Event horizon stress [unitless]',
      V_s: 'Velocity shear [unitless]',
      E_q: 'Quantum entropy loading [unitless]',
      P_spin: 'Spin shear penalty Ω_spin coupling [unitless]',
      C_s: 'Containment scalar from coherent + epoch terms [unitless]',
      Ω_spin: 'Spin containment reinforcement [unitless]',
      resolvedWindow: '1 - |S_idx - C_s| + Ω_spin*0.08 - P_spin*0.06 [unitless]',
    },
    spinDiagnostics: {
      spinPolarization: Number(spinPolar.toFixed(3)),
      spinStability: Number(spinStability.toFixed(3)),
      spinAlignmentTerm: Number(spinAlignmentTerm.toFixed(3)),
      spinContainmentTerm: Number(spinContainmentTerm.toFixed(3)),
      spinShearPenalty: Number(spinShearPenalty.toFixed(3)),
    },
    stateLabel: resolvedWindow >= 0.72 ? 'Resolved stellar window' : resolvedWindow >= 0.46 ? 'Partial containment' : 'Unstable singularity edge',
  };
}
