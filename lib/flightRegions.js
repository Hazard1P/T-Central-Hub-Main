export const SOLAR_FLIGHT_IDS = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
export const SOLAR_FLIGHT_CENTER = Object.freeze([0, 0, 52]);
export const SOLAR_FLIGHT_RADIUS = 8;
export const resolveSolarBody = (value) => value === 'geo' ? 'earth' : SOLAR_FLIGHT_IDS.includes(value) ? value : null;

export function solarFlightRoom(baseRoom, body) {
  const id = resolveSolarBody(body);
  if (!id) return baseRoom;
  let hash = 2166136261, second = 5381;
  for (const char of baseRoom) { hash = Math.imul(hash ^ char.charCodeAt(0), 16777619); second = Math.imul(second, 33) ^ char.charCodeAt(0); }
  return `sol_${id}__${baseRoom.slice(0, 30)}__${(hash >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

export function solarBodyFromRoom(room = '') {
  const match = /^sol_([a-z]+)__[a-zA-Z0-9_-]{0,30}__[a-f0-9]{16}$/.exec(room);
  return match && SOLAR_FLIGHT_IDS.includes(match[1]) ? match[1] : null;
}

export function keepOutsideSolarBody(position, velocity) {
  const offset = position.map((value, axis) => value - SOLAR_FLIGHT_CENTER[axis]);
  const distance = Math.hypot(...offset), radius = SOLAR_FLIGHT_RADIUS + 1;
  if (distance >= radius) return { position, velocity };
  const normal = distance > 1e-9 ? offset.map((value) => value / distance) : [0, 0, -1];
  const inward = Math.min(0, velocity.reduce((sum, value, axis) => sum + value * normal[axis], 0));
  return { position: SOLAR_FLIGHT_CENTER.map((value, axis) => value + normal[axis] * radius), velocity: velocity.map((value, axis) => value - normal[axis] * inward) };
}
