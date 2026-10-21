import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getUniverseSolarState, getSolarDestinations, getFlightEnvironment, getCruiseWaypoint } from '../lib/universeFlight.js';
import { SOLAR_UNITS_PER_AU, SOLAR_WORLD_CENTER, WORLD_LIMIT, floatingOrigin, flightSubsteps } from '../lib/universeSpace.js';
import { getApproachPoint, getCruiseControl, distanceBetween, getPilotSpawn } from '../lib/exploration.js';
import { stepFrame, buildGravitySourcesFromSeed } from '../lib/simCore/stepFrame.js';
import { joinAuthoritativeRoom, updateAuthoritativePlayer, getAuthoritativeState } from '../lib/authoritativeMultiplayerStore.js';

test('all Solar bodies share a single coordinate frame with physical AU scale', () => {
  const bodies=getUniverseSolarState(Date.UTC(2026,9,18));
  assert.deepEqual(bodies.find(b=>b.id==='sun').position,SOLAR_WORLD_CENTER);
  const earth=bodies.find(b=>b.id==='earth'),moon=bodies.find(b=>b.id==='moon');
  assert.ok(distanceBetween(earth.position,SOLAR_WORLD_CENTER)>SOLAR_UNITS_PER_AU*.98);
  assert.ok(distanceBetween(earth.position,moon.position)>4000);
  assert.ok(bodies.every(b=>b.position.every(v=>Math.abs(v)<WORLD_LIMIT)));
  assert.ok(bodies.find(b=>b.id==='neptune').position.some(v=>Math.abs(v)>10_000_000));
});

test('cruise physically crosses the former world boundary, reaches Earth and keeps its global coordinates',()=>{
  const destination=getSolarDestinations().find(d=>d.key==='solar-earth');
  const target=getApproachPoint([0,0,18],destination), gravitySources=buildGravitySourcesFromSeed('continuous-route');
  let state={position:[0,0,18],velocity:[0,0,0],gravity:[0,0,0]},peak=0;
  for(let frame=0;frame<12000;frame++){
    const previous=state.position;
    state=stepFrame({...state,controlVector:getCruiseControl({...state,target}),gravitySources,dt:1/60});
    const speed=Math.hypot(...state.velocity);peak=Math.max(peak,speed);
    assert.ok(distanceBetween(previous,state.position)<100000,'no room handoff/teleport step');
    if(distanceBetween(state.position,target)<.8&&speed<.7) break;
  }
  assert.ok(distanceBetween(state.position,target)<.8);
  assert.ok(Math.hypot(...state.position)>1_000_000);
  assert.ok(peak>1000,'open space must be navigable at higher thrust');
  assert.ok(getFlightEnvironment(state.position).scale<2,'assist slows for a planetary approach');
});

test('floating render origins preserve a small ship offset at outer-system coordinates',()=>{
  for(const position of [[50_000_123.456,12000.125,-45_000_111.333],[-12345.678,900,45678.123]]){
    const origin=floatingOrigin(position),local=position.map((v,i)=>v-origin[i]);
    assert.ok(local.every(v=>Math.abs(v)<=500));
    assert.deepEqual(local.map((v,i)=>v+origin[i]),position);
  }
});

test('cruise steers around the Sun rather than cutting through its surface',()=>{
  const waypoint=getCruiseWaypoint([SOLAR_WORLD_CENTER[0]-30000,...SOLAR_WORLD_CENTER.slice(1)],[SOLAR_WORLD_CENTER[0]+30000,...SOLAR_WORLD_CENTER.slice(1)]);
  assert.ok(distanceBetween(waypoint,SOLAR_WORLD_CENTER)>10000);
  assert.ok(Math.abs(waypoint[2]-SOLAR_WORLD_CENTER[2])>10000||Math.abs(waypoint[1]-SOLAR_WORLD_CENTER[1])>10000);
});

test('shared input batches travel beyond 160 units without rejoining and peers see the same global position',t=>{
  t.mock.timers.enable({apis:['Date'],now:Date.UTC(2026,9,18)});t.after(()=>t.mock.timers.reset());
  const roomName='continuous-shared';
  const a=joinAuthoritativeRoom({roomName,identity:{id:'distance-pilot'}}),b=joinAuthoritativeRoom({roomName,identity:{id:'distance-observer'}});
  let state={position:a.player.position,velocity:a.player.velocity,gravity:[0,0,0]},frameIndex=0;
  const target=[5000,1500,4000],gravitySources=buildGravitySourcesFromSeed(roomName);
  for(let batch=0;batch<600;batch++){
    const inputs=[];
    for(let f=0;f<15;f++){
      const controlVector=getCruiseControl({...state,target});
      inputs.push({frameIndex:++frameIndex,dt:1/60,controlVector});
      state=stepFrame({...state,controlVector,dt:1/60,gravitySources});
    }
    t.mock.timers.tick(250);
    const update=updateAuthoritativePlayer({roomName,id:a.player.id,token:a.token,snapshot:{inputs}});
    assert.equal(update.ok,true);
    const self=update.state.players.find(p=>p.id===a.player.id);
    state={position:self.position,velocity:self.velocity,gravity:[0,0,0]};
    // Keep the observer present without changing identity/room.
    updateAuthoritativePlayer({roomName,id:b.player.id,token:b.token,snapshot:{controlVector:[0,0,0]}});
    if(distanceBetween(state.position,target)<2)break;
  }
  const seen=getAuthoritativeState({roomName,id:b.player.id,token:b.token});
  assert.equal(seen.state.playerCount,2);
  assert.ok(distanceBetween(seen.state.players.find(p=>p.id===a.player.id).position,target)<2);
  assert.equal(seen.room,roomName);
});

test('the game has one scene and room; celestial selection cannot reset the ship',()=>{
  const world=readFileSync(new URL('../components/StableSystemWorld.js',import.meta.url),'utf8');
  assert.match(world,/const activeRoom = roomName/);
  assert.doesNotMatch(world,/solarFlightRoom|travelSolar|shouldTransferToSolar|SolarFlightScene|setSolarBody/);
  assert.equal((world.match(/<Canvas /g)||[]).length,1);
  assert.match(world,/<UnifiedSolarSystem/);
});

test('slow render frames preserve elapsed flight time with bounded server-valid inputs',()=>{
  const payload={position:getPilotSpawn('slow-render'),velocity:[0,0,0],gravitySources:[{mass:0,position:[0,0,0]}],controlVector:[0,0,1]};
  const run=(fps)=>{let state=payload;for(let i=0;i<fps*2;i++)for(const dt of flightSubsteps(1/fps))state={...state,...stepFrame({...state,dt})};return state;};
  const fast=run(60),slow=run(5);
  assert.ok(distanceBetween(fast.position,slow.position)<.02);
  assert.ok(Math.abs(Math.hypot(...fast.velocity)-Math.hypot(...slow.velocity))<.02);
  for(const delta of [1/60,.1,.2,10]){
    const steps=flightSubsteps(delta);
    assert.ok(steps.every(dt=>dt>=1/240&&dt<=.05));
    assert.ok(Math.abs(steps.reduce((sum,dt)=>sum+dt,0)-Math.min(delta,.25))<1e-8);
  }
});

test('invalid flight vectors are sanitized before the deep-space environment is evaluated',()=>{
  for(const position of [[NaN,Infinity,-Infinity],['invalid',null,5],null]){
    const result=stepFrame({position,velocity:[NaN,Infinity,0],controlVector:[0,0,0]});
    assert.ok(result.position.every(Number.isFinite));
    assert.ok(result.velocity.every(Number.isFinite));
  }
});
