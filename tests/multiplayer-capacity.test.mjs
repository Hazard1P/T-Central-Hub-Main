import test from 'node:test';
import assert from 'node:assert/strict';
import { multiplayerCapacity, allowsMemoryMultiplayer, fleetVisibility } from '../lib/multiplayerCapacity.js';
import { joinAuthoritativeRoom, getAuthoritativeState, disconnectAuthoritativePlayer, getAuthoritativeLobby } from '../lib/authoritativeMultiplayerStore.js';
import { createRoomSnapshotCache } from '../lib/server/roomSnapshotCache.js';

test('capacity is server controlled, bounded, and production memory hosting requires an explicit choice',()=>{
 assert.equal(multiplayerCapacity({}),128);assert.equal(multiplayerCapacity({MULTIPLAYER_MAX_PLAYERS:'64'}),64);
 assert.equal(multiplayerCapacity({MULTIPLAYER_MAX_PLAYERS:'9999'}),128);assert.equal(multiplayerCapacity({NEXT_PUBLIC_MULTIPLAYER_MAX_SLOTS:'32'}),32);
 assert.equal(multiplayerCapacity({MULTIPLAYER_MAX_PLAYERS:'oops'}),128);
 assert.equal(allowsMemoryMultiplayer({NODE_ENV:'production'}),false);
 assert.equal(allowsMemoryMultiplayer({NODE_ENV:'production',MULTIPLAYER_ALLOW_IN_MEMORY:'true'}),true);
});
test('a full room rejects admission, keeps existing pilots, and immediately releases departed slots',t=>{
 const old=process.env.MULTIPLAYER_MAX_PLAYERS;process.env.MULTIPLAYER_MAX_PLAYERS='2';t.after(()=>{if(old===undefined)delete process.env.MULTIPLAYER_MAX_PLAYERS;else process.env.MULTIPLAYER_MAX_PLAYERS=old});
 const roomName='capacity-pair';
 const first=joinAuthoritativeRoom({roomName,identity:{id:'a'}}),second=joinAuthoritativeRoom({roomName,identity:{id:'b'}});
 const rejected=joinAuthoritativeRoom({roomName,identity:{id:'c'}});assert.equal(rejected.status,409);assert.equal(rejected.error,'ROOM_FULL');assert.equal(rejected.population.available,0);assert.equal(rejected.token,undefined);
 const resumed=joinAuthoritativeRoom({roomName,identity:{id:'a'}});assert.equal(resumed.token,first.token);assert.deepEqual(resumed.player.position,first.player.position);
 disconnectAuthoritativePlayer({roomName,id:'b',token:second.token});assert.equal(getAuthoritativeLobby(roomName).population.available,1);
 assert.equal(joinAuthoritativeRoom({roomName,identity:{id:'c'}}).ok,true);
});
test('128 admitted pilots all remain in the roster; a 129th cannot enter',()=>{
 const roomName='capacity-max';let last;
 for(let i=0;i<128;i++){last=joinAuthoritativeRoom({roomName,identity:{id:'pilot-'+i}});assert(last.ok)}
 const state=getAuthoritativeState({roomName,id:last.player.id,token:last.token}).state;
 assert.equal(state.players.length,128);assert(state.players.some(p=>p.id==='pilot-127'));assert.equal(state.population.capacity,128);
 assert.equal(joinAuthoritativeRoom({roomName,identity:{id:'excess'}}).status,409);
 assert.equal(JSON.stringify(state).includes(last.token),false);
});
test('stale leases free capacity and active rejoins renew it without teleporting',t=>{
 t.mock.timers.enable({apis:['Date'],now:2000000});t.after(()=>t.mock.timers.reset());
 const roomName='capacity-lease';joinAuthoritativeRoom({roomName,identity:{id:'stale'}});t.mock.timers.tick(29000);
 const active=joinAuthoritativeRoom({roomName,identity:{id:'active'}});t.mock.timers.tick(2000);
 assert.equal(getAuthoritativeLobby(roomName).population.playerCount,1);
 assert.equal(getAuthoritativeState({roomName,id:'active',token:active.token}).ok,true);
});
test('crowded scenes bound detailed ships and name tags while retaining other visible pilots as markers',()=>{
 const pilots=Array.from({length:127},(_,i)=>({id:String(i),position:[i*2,0,0]}));
 const low=fleetVisibility(pilots,[0,0,0],true),high=fleetVisibility(pilots,[0,0,0],false);
 assert.equal(low.detailed.length,8);assert.equal(low.detailed.filter(p=>p.showLabel).length,3);assert.equal(low.markers.length,119);
 assert.equal(high.detailed.length,24);assert.equal(high.markers.length,103);assert.equal(pilots.length,127);
 assert.equal(fleetVisibility([{position:[1e8,0,0]}],[0,0,0]).detailed.length,0);
});
test('snapshot reads coalesce, expire, invalidate, and retry failures without cross-room contamination',async()=>{
 let time=0,calls=0;const cache=createRoomSnapshotCache({now:()=>time,ttlMs:100});
 const read=()=>cache.read('room',async()=>++calls);
 assert.deepEqual(await Promise.all([read(),read(),read()]),[1,1,1]);time=101;assert.equal(await read(),2);
 cache.invalidate('room');assert.equal(await read(),3);assert.equal(await cache.read('other',async()=>77),77);
 await assert.rejects(cache.read('error',async()=>{throw Error('offline')}));assert.equal(await cache.read('error',async()=>99),99);
});
