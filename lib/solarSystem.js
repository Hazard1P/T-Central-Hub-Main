import {
  Body, HelioVector, GeoMoon, RotationAxis, Rotation_EQJ_ECL, RotateVector,
  Observer, ObserverVector,
} from 'astronomy-engine';

export const AU_KM = 149597870.7;
export const SIDEREAL_DAY_SECONDS = 86164.0905;
export const EARTH_EQUATORIAL_RADIUS_KM = 6378.137;
export const GEO_RADIUS_KM = Math.cbrt(398600.4418 * (SIDEREAL_DAY_SECONDS / (2 * Math.PI)) ** 2);
export const GEO_ALTITUDE_KM = GEO_RADIUS_KM - EARTH_EQUATORIAL_RADIUS_KM;
export const SOLAR_HUB_SCALE = .2; // Uniform AU-to-hub conversion; not a second orbital model.
export const SOLAR_TIME_MIN = Date.UTC(1700, 0, 1);
export const SOLAR_TIME_MAX = Date.UTC(2201, 0, 1) - 1;

// Mean volumetric radii; equatorial Earth radius is used separately for the GEO altitude.
export const SOLAR_BODIES = [
  { id: 'sun', name: 'Sun', type: 'star', radiusKm: 695700, color: '#fff2d4', periodDays: 0, rotationHours: 609.12, description: 'Our G2V star. Sunlight reaches Earth in about eight minutes.' },
  { id: 'mercury', name: 'Mercury', type: 'planet', radiusKm: 2439.7, color: '#a69c91', periodDays: 87.969, semiMajorAu: .387098, rotationHours: 1407.6, description: 'A cratered rocky world, with a 3:2 spin–orbit resonance.' },
  { id: 'venus', name: 'Venus', type: 'planet', radiusKm: 6051.8, color: '#dbbe87', periodDays: 224.701, semiMajorAu: .723332, rotationHours: -5832.5, description: 'A slowly rotating world wrapped in dense, bright clouds. Its spin is retrograde.' },
  { id: 'earth', name: 'Earth', type: 'planet', radiusKm: 6371, color: '#6caedb', periodDays: 365.256, semiMajorAu: 1, rotationHours: 23.93447, flattening: 1 / 298.257223563, description: 'Our ocean world. Its axis, daily rotation and illuminated hemisphere follow the selected time.' },
  { id: 'moon', name: 'Moon', type: 'moon', parent: 'earth', radiusKm: 1737.4, color: '#b5b4b1', periodDays: 27.321661, rotationHours: 655.72, description: 'Earth’s Moon, following its calculated orbit with libration and its actual orientation.' },
  { id: 'mars', name: 'Mars', type: 'planet', radiusKm: 3389.5, color: '#c77a56', periodDays: 686.98, semiMajorAu: 1.523679, rotationHours: 24.6229, description: 'A rocky red world with a day slightly longer than Earth’s.' },
  { id: 'jupiter', name: 'Jupiter', type: 'planet', radiusKm: 69911, color: '#d9b996', periodDays: 4332.589, semiMajorAu: 5.2026, rotationHours: 9.925, flattening: .06487, description: 'The largest planet, with cloud bands and a fast rotation. Its rendered storms are illustrative.' },
  { id: 'saturn', name: 'Saturn', type: 'planet', radiusKm: 58232, color: '#daceaa', periodDays: 10759.22, semiMajorAu: 9.5549, rotationHours: 10.656, flattening: .09796, rings: true, description: 'A gas giant surrounded by broad ice rings aligned with its equator.' },
  { id: 'uranus', name: 'Uranus', type: 'planet', radiusKm: 25362, color: '#97d4d7', periodDays: 30685.4, semiMajorAu: 19.2184, rotationHours: -17.24, description: 'An ice giant with an extreme axial tilt and retrograde rotation.' },
  { id: 'neptune', name: 'Neptune', type: 'planet', radiusKm: 24622, color: '#5685ce', periodDays: 60189, semiMajorAu: 30.1104, rotationHours: 16.11, description: 'The outermost planet, an ice giant that takes about 165 Earth years to orbit the Sun.' },
  { id: 'pluto', name: 'Pluto', type: 'dwarf planet', radiusKm: 1188.3, color: '#b2a090', periodDays: 90560, semiMajorAu: 39.482, rotationHours: -153.2928, description: 'A dwarf planet on an inclined, eccentric orbit beyond Neptune.' },
];
export const SOLAR_PLANETS = SOLAR_BODIES.filter((body) => body.type === 'planet');
export const SUN_STELLAR_PROFILE = Object.freeze({ label: 'Sun', spectralClass: 'G2V', stellarType: 'G-type main sequence', massSolar: 1, radiusSolar: 1, luminositySolar: 1, temperatureK: 5772, color: '#fff2d4', habitableInnerAu: .95, habitableOuterAu: 1.67, frostLineAu: 2.7, epochFlux: 1 });
const eclipticRotation = Rotation_EQJ_ECL();
const radians = Math.PI / 180;
const normalize = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function solarDate(value = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time) || time < SOLAR_TIME_MIN || time > SOLAR_TIME_MAX) throw new RangeError('Choose a UTC date between 1700 and 2200.');
  return date;
}

// Right-handed render coordinates: ecliptic (x,y,z) -> (x,z,-y). Positions remain in AU.
export function equatorialToSolarScene(vector) {
  const rotated = RotateVector(eclipticRotation, vector);
  return [rotated.x, rotated.z, -rotated.y];
}

function astronomyBody(body) { return Body[body.name]; }

export function bodyOrientation(body, date) {
  const axis = RotationAxis(astronomyBody(body), date);
  const north = normalize(equatorialToSolarScene(axis.north));
  let prime;
  if (body.id === 'earth') {
    // Exact Greenwich direction in EQJ: accounts for sidereal spin, precession and nutation.
    prime = normalize(equatorialToSolarScene(ObserverVector(date, new Observer(0, 0, 0), false)));
  } else {
    const ra = axis.ra * 15 * radians, dec = axis.dec * radians, w = (axis.spin % 360) * radians;
    const node = [-Math.sin(ra), Math.cos(ra), 0];
    const tangent = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)];
    const eq = { x: node[0] * Math.cos(w) + tangent[0] * Math.sin(w), y: node[1] * Math.cos(w) + tangent[1] * Math.sin(w), z: node[2] * Math.cos(w) + tangent[2] * Math.sin(w), t: axis.north.t };
    prime = normalize(equatorialToSolarScene(eq));
  }
  return { x: prime, y: north, z: normalize(cross(prime, north)) };
}

export function solarBodyPosition(id, value = Date.now()) {
  const date = solarDate(value);
  const body = SOLAR_BODIES.find((entry) => entry.id === id);
  if (!body) throw new RangeError('Unknown Solar System body.');
  if (id === 'sun') return [0, 0, 0];
  if (id === 'moon') {
    const earth = equatorialToSolarScene(HelioVector(Body.Earth, date));
    return equatorialToSolarScene(GeoMoon(date)).map((coordinate, index) => coordinate + earth[index]);
  }
  return equatorialToSolarScene(HelioVector(astronomyBody(body), date));
}

export function getSolarSystemState(value = Date.now()) {
  const date = solarDate(value);
  return SOLAR_BODIES.map((body) => {
    const position = solarBodyPosition(body.id, date);
    return { ...body, position, radiusAu: body.radiusKm / AU_KM, distanceAu: Math.hypot(...position), orientation: bodyOrientation(body, date), unix: Math.floor(date.getTime() / 1000) };
  });
}

export function geostationaryState(value = Date.now(), longitude = 0) {
  const date = solarDate(value);
  if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new RangeError('Longitude must be between −180° and 180°.');
  const relative = normalize(equatorialToSolarScene(ObserverVector(date, new Observer(0, longitude, 0), false)))
    .map((coordinate) => coordinate * GEO_RADIUS_KM / AU_KM);
  const earth = solarBodyPosition('earth', date);
  return { position: relative.map((coordinate, index) => coordinate + earth[index]), relative, longitude, latitude: 0, radiusKm: GEO_RADIUS_KM, altitudeKm: GEO_ALTITUDE_KM, periodSeconds: SIDEREAL_DAY_SECONDS };
}

export function sampleSolarOrbit(body, value = Date.now(), segments = 96) {
  const date = solarDate(value);
  if (!body.periodDays) return [];
  const period = body.periodDays * 86400000;
  // Trails are a visual guide sampled from ephemerides, not circular animation paths.
  return Array.from({ length: segments + 1 }, (_, index) => {
    const time = Math.max(SOLAR_TIME_MIN, Math.min(SOLAR_TIME_MAX, date.getTime() + (index / segments - .5) * period));
    const position = solarBodyPosition(body.id, time);
    return body.id === 'moon' ? position.map((coordinate, axis) => coordinate - solarBodyPosition('earth', time)[axis]) : position;
  });
}

export function solarClockTime({ anchorUtcMs, anchorMonotonicMs, rate }, monotonicNow) {
  return Math.max(SOLAR_TIME_MIN, Math.min(SOLAR_TIME_MAX, anchorUtcMs + (monotonicNow - anchorMonotonicMs) * rate));
}
