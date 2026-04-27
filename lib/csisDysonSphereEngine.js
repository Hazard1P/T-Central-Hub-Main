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
  const dispersalPayload = {
    channel: 'conscious-intelligence',
    throughput: Number((ring1Spin * 0.64 + entropyBudget * 0.36).toFixed(6)),
    checksum: Number((discrepancyScore * 0.5 + distributionVector.stability * 0.5).toFixed(6)),
  };
  const targetMatrix = {
    matrixScalar: Number(matrixScalar.toFixed(6)),
    routingBias: Number((distributionVector.adaptation * 0.6 + distributionVector.reserve * 0.4).toFixed(6)),
    lockstep: discrepancyScore <= 0.55,
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
  const entropyRegen = {
    regenRate: Number((ring3Spin * 0.62 + entropyBudget * 0.18 + discrepancyScore * 0.2).toFixed(6)),
    entropicFeed: Number((Math.max(0, 1 - ring3Spin) * 0.4 + multiplayerCoupling * 0.6).toFixed(6)),
    stateNodeRef: `singularity:${authActive ? 'authenticated' : 'guest'}:${sessionContext?.mode || 'unknown'}`,
  };

  return {
    ring1: {
      spin: ring1Spin,
      entropyBudget,
      discrepancyScore,
      distributionVector,
      dispersalPayload,
      targetMatrix,
      lastMeterTick: meterTick,
    },
    ring2: {
      spin: ring2Spin,
      authActive,
      providerAgnosticAuth,
      singlePlayerActive,
      multiPlayerActive,
      externalIngressEgress: {
        serverRoute: authActive ? 'csis://gateway/auth-route' : 'csis://gateway/public-route',
        dbNamespace: authActive ? 'dyson.security.auth' : 'dyson.security.guest',
        protocolVersion: '1.0.0',
        outsideEnvironment: true,
      },
    },
    ring3: {
      spin: ring3Spin,
      multiplayerCoupling,
      styleAdjustment,
      difficultyBias,
      entropyRegen,
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
      dispersalPayload: state?.ring1?.dispersalPayload ?? { channel: 'conscious-intelligence', throughput: 0, checksum: 0 },
      targetMatrix: state?.ring1?.targetMatrix ?? { matrixScalar: 0, routingBias: 0, lockstep: false },
      lastMeterTick: state?.ring1?.lastMeterTick ?? 0,
    },
    ring2: {
      spin: state?.ring2?.spin ?? 0,
      authActive: Boolean(state?.ring2?.authActive),
      providerAgnosticAuth: Boolean(state?.ring2?.providerAgnosticAuth),
      singlePlayerActive: Boolean(state?.ring2?.singlePlayerActive),
      multiPlayerActive: Boolean(state?.ring2?.multiPlayerActive),
      externalIngressEgress: state?.ring2?.externalIngressEgress ?? {
        serverRoute: 'csis://gateway/public-route',
        dbNamespace: 'dyson.security.guest',
        protocolVersion: '1.0.0',
        outsideEnvironment: true,
      },
    },
    ring3: {
      spin: state?.ring3?.spin ?? 0,
      multiplayerCoupling: state?.ring3?.multiplayerCoupling ?? 0,
      styleAdjustment: state?.ring3?.styleAdjustment ?? 0,
      difficultyBias: state?.ring3?.difficultyBias ?? 0,
      entropyRegen: state?.ring3?.entropyRegen ?? { regenRate: 0, entropicFeed: 0, stateNodeRef: 'singularity:guest:unknown' },
    },
  };
}
