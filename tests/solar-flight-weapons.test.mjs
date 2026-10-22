import test from 'node:test';
import assert from 'node:assert/strict';
import { getUniverseSolarState, constrainSolarFlight } from '../lib/universeFlight.js';
import { createPulseShot, pulsePosition, normalizedAim, segmentSphereHit, PULSE_LIFETIME_MS } from '../lib/shipWeapons.js';
import { createDebrisField } from '../lib/celestialDebris.js';
import { joinAuthoritativeRoom, applyAuthoritativeAction, getAuthoritativeState } from '../lib/authoritativeMultiplayerStore.js';
import { stepFrame } from '../lib/simCore/stepFrame.js';

test('physical Solar surfaces constrain the same global flight space while preserving tangential movement', () => {
  const utcMs=Date.UTC(2026,9,22),earth=getUniverseSolarState(utcMs).find(body=>body.id==='earth');
  const position=earth.position.map((v,i)=>v+(i===2?-10:0));
  const safe=constrainSolarFlight(position,[3,0,5],utcMs);
  assert.ok(Math.abs(Math.hypot(...safe.position.map((v,i)=>v-earth.position[i]))-(earth.radius*1.02+2))<.0001);
  assert.deepEqual(safe.velocity,[3,0,0]);
  const result=stepFrame({utcMs,worldSeed:'same-universe',position,velocity:[0,0,8],dt:.1,controlVector:[0,0,1]});
  assert.ok(Math.hypot(...result.position.map((v,i)=>v-earth.position[i]))>=earth.radius*1.02+1.999);
});

test('pulses validate aim, expire and sweep across a small asteroid between frames', () => {
  for (const direction of [[0,0,0], [NaN,0,1], [Infinity,0,1], ['1',0,1], [0,1]]) assert.equal(normalizedAim(direction), null);
  const origin = [0, 0, 0], shot = createPulseShot({ origin, direction: [0, 0, 4], now: 1000, id: 'pulse' });
  const moving = createPulseShot({origin, direction:[0,0,1], inheritedVelocity:[1000,0,0], now:1000, id:'moving'});
  assert.deepEqual(pulsePosition(moving,1500),[500,0,32]);
  origin[0] = 50;
  assert.deepEqual(pulsePosition(shot, 1500), [0, 0, 32]);
  assert.deepEqual(pulsePosition(shot, 100000), pulsePosition(shot, 1000 + PULSE_LIFETIME_MS));
  assert.deepEqual(segmentSphereHit([0,0,0], [0,0,32], [0,0,16], 1), [0,0,15]);
  assert.equal(segmentSphereHit([0,0,0], [0,0,32], [5,0,16], 1), null);
});

test('shared firing uses authoritative origin, validates ownership, cooldown and no score farming', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 5000000 }); t.after(() => t.mock.timers.reset());
  const roomName = 'pulse-security';
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
  const otherRoom = 'other-universe';
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
