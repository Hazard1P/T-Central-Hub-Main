import { UNIVERSE_LANDMARKS, WORLD_LIMIT } from './universeSpace.js';
import { getFlightEnvironment, getCruiseWaypoint, getSolarSpawn } from './universeFlight.js';
import { celestialMetrics } from './celestialScale.js';
import { FLIGHT_TUNING } from './flightTuning.js';
export const EXPLORATION_LANDMARKS = UNIVERSE_LANDMARKS.map(node => ({ ...node, ...celestialMetrics(node) }));

export const isValidRoomName = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);

export function distanceBetween(a = [0, 0, 0], b = [0, 0, 0]) {
  return Math.hypot(...a.map((value, index) => value - b[index]));
}

export function getExplorationDestinations(nodes = []) {
  const order = { planet: 0, 'asteroid field': 1, solar: 2, node: 3, dyson: 4, blackhole: 5 };
  return [...nodes.filter((node) => node.playerInteractive !== false && !(node.generated && node.kind === 'node') && ['solar', 'blackhole', 'dyson', 'node'].includes(node.kind))
    .map((node) => ({ ...node, ...celestialMetrics(node) })), ...EXPLORATION_LANDMARKS]
    .sort((a, b) => (order[a.kind] ?? 6) - (order[b.kind] ?? 6));
}

export function getPilotSpawn(id = '') {
  return getSolarSpawn(id);
}

export function getApproachPoint(position, destination) {
  const delta = position.map((value, index) => value - destination.position[index]);
  const length = Math.hypot(...delta);
  let direction = length > .001 ? delta.map((value) => value / length) : [0, 0, 1];
  const radius = destination.approachRadius || (destination.radius || 2) + 3;
  let point = destination.position.map((value, index) => value + direction[index] * radius);
  if (Math.abs(point[0]) > WORLD_LIMIT - 100 || Math.abs(point[1]) > WORLD_LIMIT - 100 || Math.abs(point[2]) > WORLD_LIMIT - 100) {
    const towardOrigin = Math.hypot(...destination.position) || 1;
    direction = destination.position.map((value) => -value / towardOrigin);
    point = destination.position.map((value, index) => value + direction[index] * radius);
  }
  return point;
}

// A velocity controller expressed as ordinary thrust, so solo and shared flight use the same controls.
export function getCruiseControl({ position, velocity, target, gravity = [0, 0, 0], braking = false, obstacles = [], utcMs = Date.now(), physicsFrame = null }) {
  const delta = target.map((value, index) => value - position[index]);
  const distance = Math.hypot(...delta);
  const environment = getFlightEnvironment(position, utcMs, obstacles, physicsFrame?.obstacles);
  const acceleration = FLIGHT_TUNING.thrust * environment.scale;
  const lead = acceleration * FLIGHT_TUNING.brakeLeadSeconds;
  // Account for controller response before the stopping burn, not only v²/2a.
  const stoppingSpeed = 2 * acceleration * distance /
    (Math.sqrt(lead * lead + 2 * acceleration * distance) + lead);
  const desiredSpeed = braking ? 0 : Math.min(environment.speedLimit * FLIGHT_TUNING.cruiseFraction,
    stoppingSpeed * FLIGHT_TUNING.approachMargin,
    distance * .8);
  const waypoint = braking ? target : getCruiseWaypoint(position, target, utcMs, obstacles);
  const heading = waypoint.map((v,i)=>v-position[i]), headingLength = Math.hypot(...heading);
  const control = delta.map((value, index) => (((headingLength > .001 ? heading[index] / headingLength : 0) * desiredSpeed - velocity[index]) * FLIGHT_TUNING.controllerResponse - gravity[index]) / (FLIGHT_TUNING.thrust * environment.scale));
  const magnitude = Math.hypot(...control);
  return control.map((value) => value * (magnitude > FLIGHT_TUNING.maxControl ? FLIGHT_TUNING.maxControl / magnitude : 1));
}
