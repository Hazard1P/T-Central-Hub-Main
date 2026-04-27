function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toUnit(value) {
  const unit = value % 1;
  return unit < 0 ? unit + 1 : unit;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, precision = 6) {
  return Number(Number(value).toFixed(precision));
}

function hash53(value) {
  const source = String(value || '');
  let h1 = 0xdeadbeef ^ source.length;
  let h2 = 0x41c6ce57 ^ source.length;
  for (let index = 0; index < source.length; index += 1) {
    const ch = source.charCodeAt(index);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function computeSynapticsDysonState({ epoch, authContext, sessionContext, telemetry } = {}) {
  const unix = toNumber(epoch?.unix, 0);
  const matrixScalar = toNumber(epoch?.matrixScalar, 0.5);
  const siderealDrift = toNumber(epoch?.siderealDrift, 0.5);
  const dysonAlignment = toNumber(epoch?.dysonAlignment, 0.5);

  const stellarLuminosity = toNumber(telemetry?.stellarProfile?.luminositySolar, 1);
  const collectorFlux = clamp(
    0.44 + dysonAlignment * 0.36 + siderealDrift * 0.2 + toNumber(telemetry?.collectorFluxBias, 0),
    0,
    1,
  );
  const ring1Spin = round(toUnit(collectorFlux * 0.65 + dysonAlignment * 0.35));
  const stellarFeedLumens = round(stellarLuminosity * 1000 * (0.82 + dysonAlignment * 0.24), 1);

  const authenticated = Boolean(authContext?.authenticated);
  const mode = sessionContext?.mode === 'singleplayer' ? 'singleplayer' : 'multiplayer';
  const occupancyBias = toNumber(telemetry?.occupancyBias, 0.5);
  const habitatOccupancy = clamp(
    (mode === 'multiplayer' ? 0.55 : 0.4) + occupancyBias * 0.25 + (authenticated ? 0.2 : 0),
    0,
    1,
  );
  const ring2Spin = round(mode === 'multiplayer' ? toUnit(0.4 + habitatOccupancy * 0.6) : habitatOccupancy * 0.7);

  const seed = telemetry?.seed || 'synaptics-dyson';
  const hash = hash53(`${seed}:${unix}:${telemetry?.stellarProfile?.spectralClass || 'G'}`);
  const ringPhase = round((hash % 6283) / 1000, 4);
  const encryptionStrength = round(clamp(0.62 + matrixScalar * 0.24 + siderealDrift * 0.14, 0, 1), 4);
  const keyspacePetabits = round(512 + encryptionStrength * 1536, 1);
  const ring3Spin = round(toUnit(encryptionStrength * 0.6 + ringPhase / (Math.PI * 2) * 0.4));

  return {
    ringOneLabel: 'Collector ring',
    ringTwoLabel: 'Habitat ring',
    ringThreeLabel: 'Encryption ring',
    ring1: {
      spin: ring1Spin,
      collectorFlux: round(collectorFlux, 4),
      stellarFeedLumens,
    },
    ring2: {
      spin: ring2Spin,
      habitatOccupancy: round(habitatOccupancy, 4),
      authGateOpen: authenticated,
      sessionMode: mode,
    },
    ring3: {
      spin: ring3Spin,
      encryptionStrength,
      keyspacePetabits,
      latticePhase: ringPhase,
    },
  };
}

export function summarizeSynapticsDysonState(state) {
  return {
    ringOneLabel: state?.ringOneLabel || 'Collector ring',
    ringTwoLabel: state?.ringTwoLabel || 'Habitat ring',
    ringThreeLabel: state?.ringThreeLabel || 'Encryption ring',
    ring1: {
      spin: state?.ring1?.spin ?? 0,
      collectorFlux: state?.ring1?.collectorFlux ?? 0,
      stellarFeedLumens: state?.ring1?.stellarFeedLumens ?? 0,
    },
    ring2: {
      spin: state?.ring2?.spin ?? 0,
      habitatOccupancy: state?.ring2?.habitatOccupancy ?? 0,
      authGateOpen: Boolean(state?.ring2?.authGateOpen),
      sessionMode: state?.ring2?.sessionMode || 'multiplayer',
    },
    ring3: {
      spin: state?.ring3?.spin ?? 0,
      encryptionStrength: state?.ring3?.encryptionStrength ?? 0,
      keyspacePetabits: state?.ring3?.keyspacePetabits ?? 0,
      latticePhase: state?.ring3?.latticePhase ?? 0,
    },
  };
}
