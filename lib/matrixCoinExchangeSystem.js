function asFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toUnitInterval(value) {
  return Math.max(0, Math.min(1, asFiniteNumber(value, 0)));
}

export function computeMatrixCoinDiscrepancy({
  dysonDiscrepancy = 0,
  entropyBudget = 0,
  fallbackEngaged = false,
}) {
  const normalizedDyson = toUnitInterval(dysonDiscrepancy);
  const normalizedEntropy = toUnitInterval(Math.abs(entropyBudget) / 10);
  const fallbackPenalty = fallbackEngaged ? 0.18 : 0;

  const score = Number(Math.min(1, normalizedDyson * 0.58 + normalizedEntropy * 0.3 + fallbackPenalty).toFixed(6));
  const severity = score >= 0.66 ? 'high' : score >= 0.33 ? 'medium' : 'low';

  return {
    score,
    severity,
    components: {
      dyson: normalizedDyson,
      entropy: normalizedEntropy,
      fallbackPenalty,
    },
  };
}

export function buildMatrixCoinSystemStatus({
  authContext,
  supportSession,
  dysonDiscrepancy,
  entropyBudget,
  fallbackReason,
}) {
  const fallbackEngaged = Boolean(fallbackReason);
  const discrepancy = computeMatrixCoinDiscrepancy({
    dysonDiscrepancy,
    entropyBudget,
    fallbackEngaged,
  });

  const accountLinked = Boolean(authContext?.authenticated);
  const supportLinked = Boolean(supportSession?.identifier || supportSession?.subscriptionId);
  const integrationReady = accountLinked && discrepancy.severity !== 'high';

  return {
    exchange: 'MatrixCoinExchange',
    operationalMode: fallbackEngaged ? 'fallback' : 'primary',
    fallback: {
      engaged: fallbackEngaged,
      reason: fallbackReason || null,
    },
    accountLinking: {
      linked: accountLinked,
      provider: authContext?.provider || null,
      accountId: authContext?.accountId || null,
      displayName: authContext?.displayName || null,
      supportLinked,
      supportProvider: supportSession?.provider || null,
      supportReference: supportSession?.reference || null,
    },
    discrepancy,
    integration: {
      ready: integrationReady,
      channel: integrationReady ? 'blackhole-route' : 'safe-hold',
      notes: integrationReady
        ? 'Independent API lane synchronized with blackhole route handoff.'
        : 'Integration lane is protected until discrepancy recovers.',
    },
    generatedAt: new Date().toISOString(),
  };
}
