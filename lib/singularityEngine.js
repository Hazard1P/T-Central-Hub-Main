import { clamp, lerp } from '@/lib/mathEngine';

export function resolveStarSingularity({
  gravity = 0,
  horizonFactor = 0,
  coherencePercent = 50,
  entropyPercent = 50,
  speed = 0,
  epochPhase = 0.5,
  nearestKey = 'deep_blackhole',
} = {}) {
  const coherence = clamp(coherencePercent / 100, 0, 1.2);
  const entropy = clamp(entropyPercent / 100, 0, 1.4);
  const graviticPressure = clamp(gravity / 24, 0, 1.6);
  const velocityShear = clamp(speed / 18, 0, 1.2);
  const horizonStress = clamp(horizonFactor, 0, 1.2);
  const epochResonance = 0.72 + Math.sin(epochPhase * Math.PI * 2) * 0.18;
  const containment = clamp((coherence * 0.58 + epochResonance * 0.24 + entropy * 0.18) - horizonStress * 0.34, 0.08, 1.24);
  const singularityIndex = clamp((graviticPressure * 0.34 + horizonStress * 0.32 + velocityShear * 0.16 + entropy * 0.18), 0, 1.4);
  const resolvedWindow = clamp(1 - Math.abs(singularityIndex - containment), 0, 1);
  const starTerm = lerp(0.88, 1.42, resolvedWindow);

  return {
    nearestKey,
    containment: Number(containment.toFixed(3)),
    singularityIndex: Number(singularityIndex.toFixed(3)),
    resolvedWindow: Number(resolvedWindow.toFixed(3)),
    starTerm: Number(starTerm.toFixed(3)),
    resolved: resolvedWindow >= 0.52,
    equation: 'Σ★ = (G_p + H_s + V_s + E_q) - C_s',
    stateLabel: resolvedWindow >= 0.72 ? 'Resolved stellar window' : resolvedWindow >= 0.46 ? 'Partial containment' : 'Unstable singularity edge',
  };
}
