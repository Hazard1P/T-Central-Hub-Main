import { COSMIC_GRAVITY_SOURCES } from './cosmicLayout.js';
import { SOLAR_BODIES, getSolarSystemState, geostationaryState } from './solarSystem.js';
import { SOLAR_UNITS_PER_AU, SOLAR_WORLD_CENTER, MAX_FLIGHT_SPEED, UNIVERSE_LANDMARKS } from './universeSpace.js';
import { celestialMetrics } from './celestialScale.js';
import { SHIP_CONTACT_RADIUS } from './physics/mechanics.js';
import { resolveStaticContacts } from './physics/collisions.js';

// Prediction can replay the previous UTC second while the renderer samples
// the current one. Retain a bounded history instead of recalculating both.
const solarStateCache = new Map();
export function getUniverseSolarState(utcMs = Date.now()) {
  const tick = Math.floor(utcMs / 1000) * 1000;
  if (!solarStateCache.has(tick)) {
    const bodies = getSolarSystemState(tick).map(body => ({
      ...body, position: body.position.map((v,i) => SOLAR_WORLD_CENTER[i] + v * SOLAR_UNITS_PER_AU),
      radius: body.radiusAu * SOLAR_UNITS_PER_AU,
    }));
    solarStateCache.set(tick,bodies);
    if (solarStateCache.size > 4) solarStateCache.delete(solarStateCache.keys().next().value);
  }
  return solarStateCache.get(tick);
}
export function getSolarSpawn(id = '', utcMs = Date.now()) {
  const earth = getUniverseSolarState(utcMs).find(body => body.id === 'earth');
  const towardSun = earth.position.map((v, i) => SOLAR_WORLD_CENTER[i] - v);
  const length = Math.hypot(...towardSun);
  let hash = 0;
  for (const char of String(id)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const angle = hash % 360 * Math.PI / 180, radius = 20 + hash % 9 * 6;
  const forward = towardSun.map(v=>v/length);
  const tangentLength = Math.hypot(forward[2],forward[0]) || 1;
  const right = [-forward[2]/tangentLength,0,forward[0]/tangentLength];
  const up = [forward[1]*right[2],forward[2]*right[0]-forward[0]*right[2],-forward[1]*right[0]];
  return earth.position.map((v,i)=>Number((v+forward[i]*earth.radius*3.3+(right[i]*Math.cos(angle)+up[i]*Math.sin(angle))*radius).toFixed(4)));

}
export function getSolarDestinations(utcMs = Date.now()) {
  const bodies = getUniverseSolarState(utcMs);
  const destinations = bodies.map(body => {
    const info = SOLAR_BODIES.find(entry => entry.id === body.id);
    return { ...info, key: 'solar-' + body.id, label: body.id === 'sun' ? 'Solar System · Sun' : info.name, kind: body.id === 'sun' ? 'star' : 'planet', position: body.position, radius: body.radius, approachRadius: body.radius * (info.rings ? 3.2 : 2.8) + 8, description: info.description + ' Live UTC orbit in the same shared universe.', solarBody: body.id };
  });
  const geo = geostationaryState(utcMs);
  destinations.push({ key: 'solar-geo', label: 'Earth GEO beacon', kind: 'orbital beacon', position: geo.position.map((v,i) => SOLAR_WORLD_CENTER[i] + v * SOLAR_UNITS_PER_AU), radius: 3.5, approachRadius: 14, color: '#a8ead5', description: 'A UTC-synchronized geostationary reference orbit above Earth. Fly here directly without changing rooms.' });
  return destinations;
}
// The working asteroid field follows Earth while keeping local maneuvering speeds.
export function getEarthMiningField(utcMs = Date.now()) {
  const earth = getUniverseSolarState(utcMs).find(body => body.id === 'earth');
  const direction = earth.position.map((v, i) => SOLAR_WORLD_CENTER[i] - v), length = Math.hypot(...direction);
  const center = earth.position.map((v, i) => v + direction[i] / length * (earth.radius * 14 + 1000));
  return { earth, center };
}
const staticObstacles = [
  ...COSMIC_GRAVITY_SOURCES.filter(body => body.key !== 'solar_system').map(body => { const size = celestialMetrics(body); return { ...body, radius: size.clearanceRadius, solidRadius: size.radius }; }),
  ...UNIVERSE_LANDMARKS.filter(body => body.kind === 'planet').map(body => { const size = celestialMetrics(body); return { ...body, radius: size.clearanceRadius, solidRadius: size.radius }; }),
];
export function getFlightObstacles(utcMs = Date.now(), extra = []) {
  return [...staticObstacles, ...extra, { key: 'earth-mining-field', position: getEarthMiningField(utcMs).center, radius: 500 }, ...getUniverseSolarState(utcMs).map(body => ({ ...body, key: 'solar-' + body.id, radius: body.radius * (body.id === 'saturn' ? 2.4 : 1.02) + 2 }))];
}
export function getFlightEnvironment(position, utcMs = Date.now(), extra = [], preparedObstacles = null) {
  let clearance = Infinity, physicalSolar = false, nearestRadius = 0;
  for (const body of preparedObstacles || getFlightObstacles(utcMs, extra)) {
    const distance = Math.hypot(...position.map((v,i) => v - body.position[i])) - body.radius;
    if (distance < clearance) { clearance = distance; physicalSolar = Boolean(body.id); nearestRadius = body.radius; }
  }
  // Keep the larger fictional regions traversable while physical Solar
  // approaches retain their existing speed curve.
  clearance = Math.max(0, clearance);
  const slowZone = physicalSolar ? Math.max(160, Math.min(340, nearestRadius * 2)) : 40;
  const scale = Math.min(200_000, 1 + (Math.max(0, clearance - slowZone) / (physicalSolar ? 50 : 25)) ** 1.5);
  return { scale, clearance, speedLimit: Math.min(MAX_FLIGHT_SPEED, 20 * scale, Math.max(20, clearance * 1.5)) };
}
export function getFlightSolids(utcMs = Date.now(), extra = []) {
  return [...staticObstacles, ...extra, ...getUniverseSolarState(utcMs)].map(body => ({
    ...body, key: body.key || 'solar-' + body.id,
    collisionRadius: (body.solidRadius || body.radius) * Math.max(1.02, 1 / Math.cbrt(1 - (body.flattening || 0))) + 2,
  }));
}
export function constrainSolarFlight(position, velocity, utcMs = Date.now(), extra = []) {
  return resolveStaticContacts({ from: position, position, velocity, bodies: getFlightSolids(utcMs, extra), radius: SHIP_CONTACT_RADIUS });
}
// Bend a cruise course around an intervening body instead of flying through it.
export function getCruiseWaypoint(position, target, utcMs = Date.now(), extra = []) {
  const delta = target.map((v,i) => v-position[i]), length = Math.hypot(...delta);
  if (length < 1e-6) return target;
  const dir = delta.map(v => v/length);
  let obstruction, closest = Infinity;
  for (const body of getFlightObstacles(utcMs, extra)) {
    const offset = body.position.map((v,i) => v-position[i]), along = offset.reduce((s,v,i) => s+v*dir[i],0);
    if (along <= 0 || along >= length || along >= closest) continue;
    const normal = offset.map((v,i) => along*dir[i]-v), lateral = Math.hypot(...normal), radius = body.radius + Math.max(5, body.radius*.2);
    if (lateral >= radius || Math.hypot(...target.map((v,i)=>v-body.position[i])) <= body.radius) continue;
    const side = lateral > .001 ? normal.map(v=>v/lateral) : Math.abs(dir[1]) < .9 ? [-dir[2],0,dir[0]] : [0,-dir[2],dir[1]];
    const sideLength = Math.hypot(...side);
    obstruction = body.position.map((v,i)=>v+side[i]/sideLength*radius*1.8); closest=along;
  }
  return obstruction || target;
}
