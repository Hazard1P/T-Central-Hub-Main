import { clamp, lerp, smoothstep } from '@/lib/mathEngine';

export const ENTROPIC_CURRENCY = {
  symbol: 'E_s',
  label: 'Entropic Scalar Credits',
  shortLabel: 'E_s credits',
};

export function computeEntropicIntegrity({ coherence = 0.5, horizonFactor = 0, routeAssist = true, dampers = true, boostActive = false }) {
  const routeBonus = routeAssist ? 0.08 : -0.04;
  const damperBonus = dampers ? 0.06 : -0.03;
  const boostPenalty = boostActive ? 0.05 : 0;
  return clamp(coherence * 0.72 + routeBonus + damperBonus - horizonFactor * 0.32 - boostPenalty, 0.18, 1.18);
}

export function resolveEntropicYield({
  entropyUnits = 0,
  coherencePercent = 50,
  entropyPercent = 50,
  horizonFactor = 0,
  routeIntegrity = 0.6,
  singularityContainment = 0.6,
  engineScale = 1,
} = {}) {
  const units = Math.max(0, Number(entropyUnits) || 0);
  const coherence = clamp(coherencePercent / 100, 0, 1.4);
  const entropy = clamp(entropyPercent / 100, 0, 1.4);
  const singularityGain = lerp(0.9, 1.36, clamp(singularityContainment, 0, 1));
  const stabilityGain = lerp(0.72, 1.28, clamp(routeIntegrity, 0, 1.2));
  const horizonLoss = lerp(0.04, 0.24, clamp(horizonFactor, 0, 1));
  const compression = clamp((coherence * 0.58 + entropy * 0.22 + singularityGain * 0.2) * stabilityGain * engineScale, 0.35, 2.6);
  const stabilizedEntropy = units * compression * (1 - horizonLoss);
  const creditRate = 8.4 + coherence * 4.8 + singularityGain * 2.6;
  const quote = stabilizedEntropy * creditRate;

  return {
    units: Number(units.toFixed(2)),
    stabilizedEntropy: Number(stabilizedEntropy.toFixed(2)),
    containment: Number((singularityGain * (1 - horizonLoss)).toFixed(3)),
    creditRate: Number(creditRate.toFixed(2)),
    quote: Number(quote.toFixed(2)),
    currency: ENTROPIC_CURRENCY,
    equation: `${ENTROPIC_CURRENCY.symbol} = ΔE × C × S × (1 - H) × R`,
    diagnostics: {
      coherence: Number(coherence.toFixed(3)),
      entropy: Number(entropy.toFixed(3)),
      routeIntegrity: Number(routeIntegrity.toFixed(3)),
      singularityContainment: Number(singularityContainment.toFixed(3)),
      horizonLoss: Number(horizonLoss.toFixed(3)),
    },
  };
}

export function summarizeEntropicEconomy(progress = {}) {
  const mined = Number(progress.entropyMined || 0);
  const resolved = Number(progress.entropyResolved || 0);
  const scalarCredits = Number(progress.credits || 0);
  const unresolved = Math.max(0, mined - resolved);
  const yieldBand = smoothstep(0, 120, scalarCredits);

  return {
    mined,
    resolved,
    unresolved,
    scalarCredits,
    currency: ENTROPIC_CURRENCY,
    yieldBand: yieldBand > 0.66 ? 'high-yield' : yieldBand > 0.33 ? 'mid-yield' : 'cold-start',
  };
}
