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


function round(value, precision = 3) {
  return Number(Number(value).toFixed(precision));
}

const STELLAR_CLASSES = {
  O: { mass: [16, 40], temp: [30000, 50000], luminosity: [30000, 1000000], radius: [6.6, 15], color: '#9bb0ff' },
  B: { mass: [2.1, 16], temp: [10000, 30000], luminosity: [25, 30000], radius: [1.8, 6.6], color: '#aabfff' },
  A: { mass: [1.4, 2.1], temp: [7500, 10000], luminosity: [5, 25], radius: [1.4, 1.8], color: '#cad7ff' },
  F: { mass: [1.04, 1.4], temp: [6000, 7500], luminosity: [1.5, 5], radius: [1.15, 1.4], color: '#f8f7ff' },
  G: { mass: [0.8, 1.04], temp: [5200, 6000], luminosity: [0.6, 1.5], radius: [0.96, 1.15], color: '#fff4ea' },
  K: { mass: [0.45, 0.8], temp: [3700, 5200], luminosity: [0.08, 0.6], radius: [0.7, 0.96], color: '#ffd2a1' },
  M: { mass: [0.08, 0.45], temp: [2400, 3700], luminosity: [0.0005, 0.08], radius: [0.15, 0.7], color: '#ffcc6f' },
};

function interpolateRange(range, ratio) {
  return range[0] + (range[1] - range[0]) * ratio;
}

export function createStellarProfile({ seed = 'central-star', classHint = 'G', label = 'Central.Star' } = {}) {
  const canonicalClass = String(classHint || 'G').trim().toUpperCase();
  const spectralClass = STELLAR_CLASSES[canonicalClass[0]] ? canonicalClass[0] : 'G';
  const seedHash = hash53(`${seed}:${spectralClass}:${label}`);
  const ratio = ((seedHash % 10000) / 9999);
  const data = STELLAR_CLASSES[spectralClass];
  const massSolar = interpolateRange(data.mass, ratio);
  const temperatureK = interpolateRange(data.temp, ratio);
  const luminositySolar = interpolateRange(data.luminosity, ratio);
  const radiusSolar = interpolateRange(data.radius, ratio);
  const frostLineAu = 2.7 * Math.sqrt(massSolar);
  const habitableInnerAu = 0.95 * Math.sqrt(luminositySolar);
  const habitableOuterAu = 1.67 * Math.sqrt(luminositySolar);
  const epochFlux = 0.92 + ((seedHash >> 7) % 900) / 1000;

  return {
    label,
    spectralClass: canonicalClass,
    stellarType: `${spectralClass}-class main sequence`,
    massSolar: round(massSolar),
    temperatureK: Math.round(temperatureK),
    luminositySolar: round(luminositySolar),
    radiusSolar: round(radiusSolar),
    color: data.color,
    habitableInnerAu: round(habitableInnerAu),
    habitableOuterAu: round(habitableOuterAu),
    frostLineAu: round(frostLineAu),
    epochFlux: round(epochFlux),
  };
}

export function scaleOrbitForStar(orbitAu, stellarProfile) {
  const massScale = Math.pow(stellarProfile?.massSolar || 1, 0.34);
  return round(orbitAu * massScale, 3);
}

export function periodYearsForOrbit(orbitAu, stellarProfile) {
  const massSolar = stellarProfile?.massSolar || 1;
  return round(Math.sqrt((orbitAu ** 3) / massSolar), 4);
}

export function classifyPlanetZone(orbitAu, stellarProfile) {
  const inner = stellarProfile?.habitableInnerAu || 0.95;
  const outer = stellarProfile?.habitableOuterAu || 1.67;
  const frost = stellarProfile?.frostLineAu || 2.7;
  if (orbitAu < inner) return 'inner';
  if (orbitAu <= outer) return 'habitable';
  if (orbitAu <= frost) return 'outer';
  return 'frost';
}
