function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toUnit(value) {
  const unit = value % 1;
  return unit < 0 ? unit + 1 : unit;
}

export function computeCsisDysonState({ epoch, authContext, sessionContext, telemetry } = {}) {
  const unix = toNumber(epoch?.unix, 0);
  const dysonPhase = toNumber(epoch?.dysonAlignment, 0);
  const siderealPhase = toNumber(epoch?.siderealDrift, 0);
  const matrixScalar = toNumber(epoch?.matrixScalar, 0.5);

  const meterTick = toNumber(telemetry?.meterTick, unix);
  const previousMeterTick = toNumber(telemetry?.previousMeterTick, meterTick);
  const discrepancyDelta = Math.abs(toNumber(telemetry?.discrepancyDelta, 0));
  const meteringDelta = Math.abs(meterTick - previousMeterTick);

  const ring1Spin = Number(toUnit((meteringDelta / 60) + discrepancyDelta * 0.73 + dysonPhase * 0.2).toFixed(6));
  const entropyBudget = Number((0.35 + ring1Spin * 0.45 + matrixScalar * 0.2).toFixed(6));
  const discrepancyScore = Number((Math.min(1, discrepancyDelta + meteringDelta / 120)).toFixed(6));
  const distributionVector = {
    stability: Number((Math.max(0, 1 - discrepancyScore) * 0.52).toFixed(6)),
    adaptation: Number((ring1Spin * 0.28 + discrepancyScore * 0.22).toFixed(6)),
    reserve: Number((Math.max(0, 1 - ring1Spin) * 0.2 + matrixScalar * 0.08).toFixed(6)),
  };

  const authActive = Boolean(authContext?.authenticated);
  const providerAgnosticAuth = authActive;
  const singlePlayerActive = Boolean(sessionContext?.mode === 'singleplayer');
  const multiPlayerActive = Boolean(sessionContext?.mode === 'multiplayer');
  const ring2Spin = authActive ? Number((0.65 + dysonPhase * 0.35).toFixed(6)) : 0;

  const multiplayerCoupling = multiPlayerActive
    ? Number((0.5 + siderealPhase * 0.5).toFixed(6))
    : 0;
  const styleAdjustment = multiPlayerActive
    ? Number((toNumber(telemetry?.styleSignal, 0.5) * 0.6 + ring1Spin * 0.4).toFixed(6))
    : 0;
  const difficultyBias = multiPlayerActive
    ? Number((0.45 + multiplayerCoupling * 0.35 + discrepancyScore * 0.2).toFixed(6))
    : 0;
  const ring3Spin = multiPlayerActive
    ? Number(toUnit(multiplayerCoupling + styleAdjustment * 0.37 + siderealPhase * 0.15).toFixed(6))
    : 0;

  return {
    ring1: {
      spin: ring1Spin,
      entropyBudget,
      discrepancyScore,
      distributionVector,
      lastMeterTick: meterTick,
    },
    ring2: {
      spin: ring2Spin,
      authActive,
      providerAgnosticAuth,
      singlePlayerActive,
      multiPlayerActive,
    },
    ring3: {
      spin: ring3Spin,
      multiplayerCoupling,
      styleAdjustment,
      difficultyBias,
    },
  };
}

export function summarizeCsisDysonState(state) {
  return {
    ring1: {
      spin: state?.ring1?.spin ?? 0,
      entropyBudget: state?.ring1?.entropyBudget ?? 0,
      discrepancyScore: state?.ring1?.discrepancyScore ?? 0,
      distributionVector: state?.ring1?.distributionVector ?? { stability: 0, adaptation: 0, reserve: 0 },
      lastMeterTick: state?.ring1?.lastMeterTick ?? 0,
    },
    ring2: {
      spin: state?.ring2?.spin ?? 0,
      authActive: Boolean(state?.ring2?.authActive),
      providerAgnosticAuth: Boolean(state?.ring2?.providerAgnosticAuth),
      singlePlayerActive: Boolean(state?.ring2?.singlePlayerActive),
      multiPlayerActive: Boolean(state?.ring2?.multiPlayerActive),
    },
    ring3: {
      spin: state?.ring3?.spin ?? 0,
      multiplayerCoupling: state?.ring3?.multiplayerCoupling ?? 0,
      styleAdjustment: state?.ring3?.styleAdjustment ?? 0,
      difficultyBias: state?.ring3?.difficultyBias ?? 0,
    },
  };
}
