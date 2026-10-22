import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { newShipWallet, applyShipAction, miningGeometry, miningTarget, economyLocation, shipStats } from '../lib/shipEconomy.js';
import { createShipEconomyRepository } from '../lib/server/shipEconomyRepository.js';

test('mining needs a trusted nearby slow pilot, and aim must hit a catalog rock', () => {
  const now = 1792537200000, {rocks,earth} = miningGeometry(now), rock = rocks[0];
  const player = {position: rock.position.map((v,i)=>v+(i===0?50:0)),velocity:[0,0,0]};
  assert.equal(miningTarget(player,{direction:[-1,0,0]},now).id,rock.id);
  assert.equal(miningTarget(player,{asteroid:rock.id},now).id,rock.id);
  assert.throws(()=>miningTarget({...player,position:earth.position},{asteroid:rock.id},now),/180/);
  assert.throws(()=>miningTarget({...player,velocity:[26,0,0]},{asteroid:rock.id},now),/Brake/);
  assert.throws(()=>miningTarget(player,{direction:[0,0,0]},now),/aim/);
  const dock={position:earth.position.map((v,i)=>v+(i===0?earth.radius*3:0)),velocity:[0,0,0]};
  assert(economyLocation(dock,now).atEarth); assert(economyLocation(dock,now).slow);
});
test('damage, shared depletion, cooldown, cargo cap and regeneration obey the published rules',()=>{
 let wallet=newShipWallet(), rocks={}, now=10000;
 const mine=()=>{const r=applyShipAction(wallet,rocks,{action:'mine',asteroid:'ore-0'},now);wallet=r.wallet;now+=700;return r.receipt};
 assert.equal(mine().hp,2);assert.throws(()=>applyShipAction(wallet,rocks,{action:'mine',asteroid:'ore-0'},now-650),/cooling/);
 assert.equal(wallet.cargo,1); assert.equal(mine().hp,1); assert.equal(mine().ore,2); assert.equal(wallet.cargo,4);
 assert.throws(mine,/depleted/);now+=45000;assert.equal(mine().hp,2);
 wallet={...wallet,cargo:19,laser_level:2};now+=1000;assert.equal(mine().ore,1);assert.equal(wallet.cargo,20);
 assert.throws(mine,/full/);assert.equal(shipStats({cargo_level:3,laser_level:3}).capacity,65);
});
test('cooperative hits split the finite yield by actual damage, including upgraded overkill and regeneration', () => {
 for (let index=0;index<24;index++) for (const levels of [[0,0,0],[1,0],[0,1],[3]]) {
  const rocks={}, id='ore-'+index, receipts=[];
  for (let i=0;i<levels.length;i++) receipts.push(applyShipAction({...newShipWallet(),laser_level:levels[i]},rocks,{action:'mine',asteroid:id},10000+i*1000).receipt);
  assert.equal(receipts.reduce((sum,r)=>sum+r.damage,0),3);
  assert.equal(receipts.reduce((sum,r)=>sum+r.ore,0),4+index%4);
  assert(receipts.every(r=>r.ore>0));
  assert.equal(rocks[id].hp,0);
  assert.throws(()=>applyShipAction(newShipWallet(),rocks,{action:'mine',asteroid:id},13000),/depleted/);
  const reset=applyShipAction(newShipWallet(),rocks,{action:'mine',asteroid:id},60000);
  assert.equal(reset.receipt.hp,2);assert.equal(reset.receipt.depletedUntil,0);
 }
});
test('concurrent pilots earn their own ore from shared integrity; replay cannot mine twice', async () => {
 const dir=await mkdtemp(path.join(os.tmpdir(),'coop-mining-'));
 const store=createShipEconomyRepository({localPath:path.join(dir,'wallet.json')});
 try {
  const ids=['google:one','steam:two','guest:three'], requests=ids.map(()=>randomUUID());
  const run=(i)=>store.run({owner:ids[i],room:'coop',token:'flight-token-'+i,requestId:requests[i],command:{action:'mine',asteroid:'ore-3'},now:10000});
  const hits=await Promise.all(ids.map((_,i)=>run(i)));
  assert.deepEqual(hits.map(r=>r.wallet.cargo),[2,2,3]);
  assert.equal(hits.reduce((sum,r)=>sum+r.wallet.cargo,0),7);
  const replay=await run(0);assert.equal(replay.replay,true);assert.equal(replay.wallet.cargo,2);
  assert.deepEqual(Object.keys(replay.rocks['ore-3']).sort(),['depleted_until','hp']);
  const state=await store.run({owner:ids[0],room:'coop',token:'fresh-flight-token',command:{action:'state'},now:11000});
  assert.equal(state.wallet.cargo,0);assert.equal(state.rocks['ore-3'].hp,0);
 } finally { await rm(dir,{recursive:true,force:true}); }
});
test('Earth delivery and upgrades cannot overdraw, run remotely, or repeat a stale purchase',()=>{
 const wallet={...newShipWallet(),cargo:15};const cmd={action:'deliver',atEarth:true,slow:true};
 assert.throws(()=>applyShipAction(wallet,{}, {...cmd,atEarth:false}),/Return/);
 const result=applyShipAction(wallet,{},cmd);assert.equal(result.wallet.credits,150);assert.equal(result.wallet.cargo,0);
 assert.throws(()=>applyShipAction(result.wallet,{},cmd),/empty/);
 const buy={action:'upgrade',atEarth:true,slow:true,upgrade:'cargo',expectedLevel:0};
 const upgrade=applyShipAction(result.wallet,{},buy);assert.equal(upgrade.wallet.credits,30);assert.equal(upgrade.wallet.cargo_level,1);
 assert.throws(()=>applyShipAction(upgrade.wallet,{},buy),/changed/);
 assert.throws(()=>applyShipAction(upgrade.wallet,{}, {...buy,expectedLevel:1}),/Earn/);
 assert.throws(()=>applyShipAction({...upgrade.wallet,cargo_level:3}, {}, {...buy,expectedLevel:3}),/maximum/);
});
test('repository serializes shared rocks, replays receipts once, isolates providers, and discards only cargo on respawn',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'ship-economy-'));const store=createShipEconomyRepository({localPath:path.join(dir,'wallet.json')});
 const args={owner:'google:123',room:'public',token:'flight-token-0001'};let now=10000;
 const run=(command, requestId=randomUUID(),extra={})=>store.run({...args,requestId,command,now:now+=1000,...extra});
 try{
  await run({action:'mine',asteroid:'ore-0'});await run({action:'mine',asteroid:'ore-0'});
  const requestId=randomUUID(),command={action:'mine',asteroid:'ore-0'};
  const [first,replay]=await Promise.all([run(command,requestId),run(command,requestId)]);
  assert.equal(first.wallet.cargo,4);assert.equal(replay.wallet.cargo,4);assert.equal(replay.replay,true);
  await assert.rejects(run(command,randomUUID(),{owner:'steam:123'}),/depleted/);
  let state=await run({action:'deliver',atEarth:true,slow:true});assert.equal(state.wallet.credits,40);
  for(const asteroid of ['ore-1','ore-2','ore-3'])for(let i=0;i<3;i++)state=await run({action:'mine',asteroid});
  assert(state.wallet.cargo>0);
  state=await run({action:'state'},randomUUID(),{token:'flight-token-0002'});
  assert.equal(state.wallet.cargo,0);assert.equal(state.wallet.credits,40);
  assert.equal('flight_token' in state.wallet,false);
  state=await run({action:'state'},randomUUID(),{owner:'steam:123'});assert.equal(state.wallet.credits,0);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('production without a database fails explicitly instead of granting client progress',async()=>{
 await assert.rejects(createShipEconomyRepository().run({owner:'google:1',room:'public',token:'test'}),/database configuration/);
});
test('mining field reduces deep-space assist to safe local maneuvering speeds',async()=>{
 const {getFlightEnvironment}=await import('../lib/universeFlight.js');
 const now=1792537200000, {center}=miningGeometry(now),near=getFlightEnvironment(center,now);
 assert.equal(near.scale,1);assert.equal(near.speedLimit,20);
 assert(getFlightEnvironment(center.map((v,i)=>v+(i===0?10000:0)),now).speedLimit>near.speedLimit);
});
test('profile summaries expose saved upgrades without credentials or clearing carried ore',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'ship-profile-')),store=createShipEconomyRepository({localPath:path.join(dir,'wallet.json')});
 const args={owner:'google:profile',room:'profile',token:'flight-token-profile'};
 try{
  for(let i=0;i<3;i++)await store.run({...args,requestId:randomUUID(),command:{action:'mine',asteroid:'ore-0'},now:10000+i*1000});
  const summary=await store.summary(args.owner);assert.equal(summary.credits,0);assert.equal(summary.stats.capacity,20);
  assert.equal('flight_token' in summary,false);assert.equal('cargo' in summary,false);
  assert.equal((await store.run({...args,command:{action:'state'},now:14000})).wallet.cargo,4);
  assert.equal((await store.summary('steam:profile')).delivered,0);
 }finally{await rm(dir,{recursive:true,force:true})}
});
