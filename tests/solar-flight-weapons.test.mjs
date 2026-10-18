import test from 'node:test';
import assert from 'node:assert/strict';
import { solarFlightRoom, solarBodyFromRoom, SOLAR_FLIGHT_IDS, keepOutsideSolarBody } from '../lib/flightRegions.js';
import { createPulseShot, pulsePosition, normalizedAim, segmentSphereHit, PULSE_LIFETIME_MS } from '../lib/shipWeapons.js';
import { createDebrisField } from '../lib/celestialDebris.js';
import { joinAuthoritativeRoom, applyAuthoritativeAction, getAuthoritativeState } from '../lib/authoritativeMultiplayerStore.js';
import { stepFrame } from '../lib/simCore/stepFrame.js';

test('planet rooms preserve rendezvous identity and isolate regions, including long room names', () => {
  const base = 'a'.repeat(64);
  const rooms = SOLAR_FLIGHT_IDS.map(id => solarFlightRoom(base, id));
  assert.equal(new Set(rooms).size, SOLAR_FLIGHT_IDS.length);
  rooms.forEach((room, i) => { assert.ok(room.length <= 64); assert.match(room, /^[a-zA-Z0-9_-]+$/); assert.equal(solarBodyFromRoom(room), SOLAR_FLIGHT_IDS[i]); });
  assert.notEqual(solarFlightRoom(base, 'earth'), solarFlightRoom(base.slice(0, 63) + 'b', 'earth'));
  assert.equal(solarFlightRoom(base, null), base);
  assert.equal(solarBodyFromRoom('sol_earth_fake'), null);
});

test('solar flight stops at the surface and keeps sideways motion in client/server stepping', () => {
  const safe = keepOutsideSolarBody([0, 0, 50], [3, 0, 5]);
  assert.deepEqual(safe, { position: [0, 0, 43], velocity: [3, 0, 0] });
  assert.ok(keepOutsideSolarBody([0, 0, 52], [0, 0, 0]).position.every(Number.isFinite));
  const result = stepFrame({ worldSeed: solarFlightRoom('boundary', 'earth'), position: [0, 0, 43.01], velocity: [0, 0, 8], dt: .1, controlVector: [0, 0, 1] });
  assert.ok(result.position[2] <= 43.001); assert.equal(result.velocity[2], 0);
});

test('pulses validate aim, expire and sweep across a small asteroid between frames', () => {
  for (const direction of [[0,0,0], [NaN,0,1], [Infinity,0,1], ['1',0,1], [0,1]]) assert.equal(normalizedAim(direction), null);
  const origin = [0, 0, 0], shot = createPulseShot({ origin, direction: [0, 0, 4], now: 1000, id: 'pulse' });
  origin[0] = 50;
  assert.deepEqual(pulsePosition(shot, 1500), [0, 0, 32]);
  assert.deepEqual(pulsePosition(shot, 100000), pulsePosition(shot, 1000 + PULSE_LIFETIME_MS));
  assert.deepEqual(segmentSphereHit([0,0,0], [0,0,32], [0,0,16], 1), [0,0,15]);
  assert.equal(segmentSphereHit([0,0,0], [0,0,32], [5,0,16], 1), null);
});

test('shared firing uses authoritative origin, validates ownership, cooldown and no score farming', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 5000000 }); t.after(() => t.mock.timers.reset());
  const roomName = solarFlightRoom('pulse-security', 'earth');
  const a = joinAuthoritativeRoom({ roomName, identity: { id: 'cannon-pilot-a' } });
  const b = joinAuthoritativeRoom({ roomName, identity: { id: 'cannon-pilot-b' } });
  const args = { roomName, id: a.player.id, token: a.token };
  assert.equal(applyAuthoritativeAction({ ...args, token: b.token, action: { type: 'fire' } }).status, 401);
  assert.equal(applyAuthoritativeAction({ ...args, action: { type: 'fire', direction: [0,0,0] } }).status, 400);
  const fire = () => applyAuthoritativeAction({ ...args, action: { type: 'fire', origin: [159,119,159], direction: [0,0,2] } });
  const first = fire(); assert.equal(first.ok, true);
  assert.deepEqual(first.state.projectiles[0].position, a.player.position.map(value => Number(value.toFixed(2))));
  assert.equal(fire().status, 429);
  t.mock.timers.tick(250); const second = fire(); assert.equal(second.ok, true);
  assert.ok(second.state.projectiles[0].position[2] > a.player.position[2]);
  assert.equal(second.state.players.find(p => p.id === a.player.id).score, a.player.score);
  const otherRoom = solarFlightRoom('pulse-security', 'mars');
  const c = joinAuthoritativeRoom({ roomName: otherRoom, identity: { id: 'cannon-pilot-c' } });
  assert.equal(getAuthoritativeState({ roomName: otherRoom, id: c.player.id, token: c.token }).state.projectiles.length, 0);
  t.mock.timers.tick(PULSE_LIFETIME_MS + 1);
  assert.equal(getAuthoritativeState(args).state.projectiles.length, 0);
});

test('asteroid field positions are deterministic across pilots and quality levels', () => {
  const full = createDebrisField(80), small = createDebrisField(28);
  assert.deepEqual(full.slice(0, 28), small);
  assert.notDeepEqual(createDebrisField(28, true), small);
  assert.ok(full.every(rock => rock.position.every(Number.isFinite) && rock.radius > 0));
});
