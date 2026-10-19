import { COSMIC_GRAVITY_SOURCES } from './cosmicLayout.js';
import { SOLAR_BODIES, getSolarSystemState, geostationaryState } from './solarSystem.js';
import { SOLAR_UNITS_PER_AU, SOLAR_WORLD_CENTER, MAX_FLIGHT_SPEED, UNIVERSE_LANDMARKS } from './universeSpace.js';

let cache;
export function getUniverseSolarState(utcMs = Date.now()) {
  const tick = Math.floor(utcMs / 1000) * 1000;
  if (cache?.tick !== tick) cache = { tick, bodies: getSolarSystemState(tick).map(body => ({
    ...body, position: body.position.map((v,i) => SOLAR_WORLD_CENTER[i] + v * SOLAR_UNITS_PER_AU),
    radius: body.radiusAu * SOLAR_UNITS_PER_AU,
  })) };
  return cache.bodies;
}
export function getSolarDestinations(utcMs = Date.now()) {
  const bodies = getUniverseSolarState(utcMs);
  const destinations = bodies.map(body => {
    const info = SOLAR_BODIES.find(entry => entry.id === body.id);
    return { ...info, key: 'solar-' + body.id, label: body.id === 'sun' ? 'Solar System · Sun' : info.name, kind: body.id === 'sun' ? 'star' : 'planet', position: body.position, radius: body.radius, approachRadius: body.radius * (info.rings ? 3.2 : 2.8) + 8, description: info.description + ' Live UTC orbit in the same shared universe.', solarBody: body.id };
  });
  const geo = geostationaryState(utcMs);
  destinations.push({ key: 'solar-geo', label: 'Earth GEO beacon', kind: 'orbital beacon', position: geo.position.map((v,i) => SOLAR_WORLD_CENTER[i] + v * SOLAR_UNITS_PER_AU), radius: .5, approachRadius: 5, color: '#a8ead5', description: 'A UTC-synchronized geostationary reference orbit above Earth. Fly here directly without changing rooms.' });
  return destinations;
}
const staticObstacles = [
  ...COSMIC_GRAVITY_SOURCES.filter(body => body.key !== 'solar_system').map(body => ({ ...body, radius: body.kind === 'solar' ? 8 : body.kind === 'dyson' ? 4 : 2 })),
  ...UNIVERSE_LANDMARKS.filter(body => body.kind === 'planet').map(body => ({ ...body, radius: body.key === 'halcyon' ? 37 : body.radius })),
];
export function getFlightObstacles(utcMs = Date.now()) {
  return [...staticObstacles, ...getUniverseSolarState(utcMs).map(body => ({ ...body, key: 'solar-' + body.id, radius: body.radius * (body.id === 'saturn' ? 2.4 : 1.02) + 2 }))];
}
export function getFlightEnvironment(position, utcMs = Date.now()) {
  let clearance = Infinity;
  for (const body of getFlightObstacles(utcMs)) clearance = Math.min(clearance, Math.hypot(...position.map((v,i) => v - body.position[i])) - body.radius);
  clearance = Math.max(0, clearance);
  const scale = Math.min(200_000, 1 + (Math.max(0, clearance - 160) / 50) ** 1.5);
  return { scale, clearance, speedLimit: Math.min(MAX_FLIGHT_SPEED, 20 * scale, Math.max(20, clearance * 1.5)) };
}
export function constrainSolarFlight(position, velocity, utcMs = Date.now()) {
  let result = { position, velocity };
  for (const body of getUniverseSolarState(utcMs)) {
    const delta = result.position.map((v,i) => v - body.position[i]), distance = Math.hypot(...delta), radius = body.radius * Math.max(1.02, 1 / Math.cbrt(1 - (body.flattening || 0))) + 2;
    if (distance >= radius) continue;
    const normal = distance > 1e-9 ? delta.map(v => v / distance) : [0,0,-1];
    const inward = Math.min(0, result.velocity.reduce((sum,v,i) => sum + v * normal[i], 0));
    result = { position: body.position.map((v,i) => v + normal[i] * radius), velocity: result.velocity.map((v,i) => v - normal[i] * inward) };
  }
  return result;
}
// Bend a cruise course around an intervening body instead of flying through it.
export function getCruiseWaypoint(position, target, utcMs = Date.now()) {
  const delta = target.map((v,i) => v-position[i]), length = Math.hypot(...delta);
  if (length < 1e-6) return target;
  const dir = delta.map(v => v/length);
  let obstruction, closest = Infinity;
  for (const body of getFlightObstacles(utcMs)) {
    const offset = body.position.map((v,i) => v-position[i]), along = offset.reduce((s,v,i) => s+v*dir[i],0);
    if (along <= 0 || along >= length || along >= closest) continue;
    const normal = offset.map((v,i) => along*dir[i]-v), lateral = Math.hypot(...normal), radius = body.radius + Math.max(5, body.radius*.2);
    if (lateral >= radius || Math.hypot(...target.map((v,i)=>v-body.position[i])) < radius) continue;
    const side = lateral > .001 ? normal.map(v=>v/lateral) : Math.abs(dir[1]) < .9 ? [-dir[2],0,dir[0]] : [0,-dir[2],dir[1]];
    const sideLength = Math.hypot(...side);
    obstruction = body.position.map((v,i)=>v+side[i]/sideLength*radius*1.8); closest=along;
  }
  return obstruction || target;
}
