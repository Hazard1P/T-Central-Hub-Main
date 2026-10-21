import test from 'node:test';
import assert from 'node:assert/strict';
import { celestialMetrics, COSMIC_BODY_SCALE, BLACK_HOLE_RADIUS, DYSON_OUTER_RADIUS } from '../lib/celestialScale.js';
import { WORLD_LAYOUT } from '../lib/worldLayout.js';
import { COSMIC_POSITIONS } from '../lib/cosmicLayout.js';
import { UNIVERSE_LANDMARKS } from '../lib/universeSpace.js';
import { getExplorationDestinations, getApproachPoint, distanceBetween, getCruiseControl } from '../lib/exploration.js';
import { getFlightObstacles, getCruiseWaypoint, constrainSolarFlight, getSolarSpawn, getUniverseSolarState } from '../lib/universeFlight.js';
import { joinAuthoritativeRoom, disconnectAuthoritativePlayer, updateAuthoritativePlayer } from '../lib/authoritativeMultiplayerStore.js';
import { stepFrame, buildGravitySourcesFromSeed } from '../lib/simCore/stepFrame.js';

test('every deep-space quadrant uses the same substantial body scale and safe viewing distance', () => {
  const nodes = WORLD_LAYOUT.filter(node => ['blackhole', 'dyson', 'solar'].includes(node.kind) && node.key !== 'solar_system');
  for (const node of nodes) {
    const size = celestialMetrics(node);
    assert.equal(size.renderScale, COSMIC_BODY_SCALE, node.key);
    assert(size.approachRadius > size.clearanceRadius, node.key);
    assert(size.approachRadius >= size.clearanceRadius * 3, `${node.key} fits its complete envelope in the default view`);
    assert(distanceBetween([0, 0, 18], node.position) > size.clearanceRadius + 20, `${node.key} leaves spawn clear`);
  }
  assert(BLACK_HOLE_RADIUS > 30);
  assert(DYSON_OUTER_RADIUS > 150);
});

test('enlarged planetary rings and Dyson docking lanes remain outside solid surfaces', () => {
  const destinations = getExplorationDestinations(WORLD_LAYOUT);
  for (const node of destinations.filter(node => ['blackhole', 'dyson', 'solar', 'planet'].includes(node.kind))) {
    const size = celestialMetrics(node);
    assert(distanceBetween(getApproachPoint([0, 0, 18], node), node.position) > size.clearanceRadius, node.key);
  }
  assert(distanceBetween(COSMIC_POSITIONS.ss_dock, COSMIC_POSITIONS.ss) > DYSON_OUTER_RADIUS + 30);
  assert(UNIVERSE_LANDMARKS.filter(node => node.kind === 'planet').every(node => node.radius >= 60));
});

test('navigation avoids enlarged cosmic bodies and flight cannot settle inside their surfaces', () => {
  for (const kind of ['blackhole', 'dyson', 'solar', 'planet']) {
    const body = getFlightObstacles().find(node => node.kind === kind && !node.key?.startsWith('solar-'));
    assert(body, kind);
    const start = body.position.map((v, i) => v + (i === 0 ? -body.radius * 3 : 0));
    const end = body.position.map((v, i) => v + (i === 0 ? body.radius * 3 : 0));
    assert.notDeepEqual(getCruiseWaypoint(start, end), end, kind);
    const corrected = constrainSolarFlight([...body.position], [1, 0, 0]);
    assert(distanceBetween(corrected.position, body.position) > body.solidRadius, kind);
  }
});

test('stellar orbit envelopes include every illustrated planet and preserve the physical main system', () => {
  const node = { kind: 'solar', stellarProfile: { radiusSolar: 2 }, orbiters: [{ radius: 15, tilt: 1, size: .5 }] };
  const size = celestialMetrics(node);
  assert(size.clearanceRadius > 15.5 * COSMIC_BODY_SCALE);
  assert(size.approachRadius > size.clearanceRadius);
  assert.equal(celestialMetrics({ key: 'solar_system', kind: 'solar' }).renderScale, 1);
});


test('new and returning pilots spawn safely by Earth at the current orbital epoch', () => {
  for (const utcMs of [Date.UTC(2026, 9, 20), Date.UTC(2030, 0, 1), Date.UTC(2040, 6, 1)]) {
    const earth = getUniverseSolarState(utcMs).find(body => body.id === 'earth');
    const spawn = getSolarSpawn('pilot-a', utcMs);
    assert(distanceBetween(spawn, earth.position) > earth.radius * 3);
    assert(distanceBetween(spawn, earth.position) < earth.radius * 3.6);
    assert.notDeepEqual(spawn, getSolarSpawn('pilot-b', utcMs));
    assert(spawn.every(Number.isFinite));
  }
});

test('a shared return invalidates the old pilot token and rejoins at Earth with stopped engines', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 20) });
  t.after(() => t.mock.timers.reset());
  const roomName = 'scale-respawn-test', identity = { id: 'returning-pilot' };
  const first = joinAuthoritativeRoom({ roomName, identity });
  assert.equal(disconnectAuthoritativePlayer({ roomName, id: identity.id, token: 'wrong-token' }).ok, false);
  assert.equal(disconnectAuthoritativePlayer({ roomName, id: identity.id, token: first.token }).ok, true);
  const next = joinAuthoritativeRoom({ roomName, identity });
  assert.notEqual(next.token, first.token);
  assert.deepEqual(next.player.velocity, [0, 0, 0]);
  assert.deepEqual(next.player.position, getSolarSpawn(identity.id));
  assert.equal(updateAuthoritativePlayer({ roomName, id: identity.id, token: first.token }).ok, false);
});

test('private stellar surfaces use the same avoidance and collision rules in solo flight', () => {
  const body = { key: 'private-star', privateOnly: true, position: [250_000_000, 0, 0], radius: 100_000, solidRadius: 10_000, mass: 0 };
  const start = [249_000_000, 0, 0], target = [251_000_000, 0, 0];
  assert.notDeepEqual(getCruiseWaypoint(start, target, Date.now(), [body]), target);
  const result = stepFrame({ position: body.position, velocity: [0, 0, 0], controlVector: [0, 0, 0], gravitySources: [body] });
  assert(distanceBetween(result.position, body.position) > body.solidRadius);
});

test('cruise can approach a safe target within an enlarged avoidance margin without crossing the Sun', () => {
  const sun = getUniverseSolarState().find(body => body.id === 'sun');
  const start = sun.position.map((v, i) => v + (i === 0 ? -sun.radius * 4 : 0));
  const target = sun.position.map((v, i) => v + (i === 0 ? sun.radius * 1.1 : 0));
  assert.notDeepEqual(getCruiseWaypoint(start, target), target);
});

test('ordinary cruise can traverse from Earth to the enlarged deep-space Dyson region', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 20) });
  t.after(() => t.mock.timers.reset());
  const destination = getExplorationDestinations(WORLD_LAYOUT).find(node => node.key === 'ss');
  let state = { position: getSolarSpawn('deep-space-test'), velocity: [0, 0, 0], gravity: [0, 0, 0] };
  const start = [...state.position], target = getApproachPoint(start, destination), gravitySources = buildGravitySourcesFromSeed('deep-space-test');
  for (let frame = 0; frame < 24000; frame++) {
    state = stepFrame({ ...state, controlVector: getCruiseControl({ ...state, target }), gravitySources, dt: 1 / 60 });
    if (frame % 60 === 59) t.mock.timers.tick(1000);
    if (distanceBetween(state.position, target) < 2 && Math.hypot(...state.velocity) < 1) break;
  }
  assert(distanceBetween(start, state.position) > 100_000_000);
  assert(distanceBetween(state.position, target) < 2);
  assert(distanceBetween(state.position, destination.position) > celestialMetrics(destination).clearanceRadius);
});
