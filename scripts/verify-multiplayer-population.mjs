import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

// Local, synthetic traffic only. This is not a production capacity certificate.
const base = new URL(process.env.MULTIPLAYER_TEST_BASE_URL || 'http://127.0.0.1:3700');
assert(['localhost','127.0.0.1','[::1]'].includes(base.hostname),'Population verification is restricted to a local test server.');
const roomName = 'population-' + Date.now().toString(36), sessions = [], samples = [];
const seconds = Math.max(1,Math.min(30,Number(process.env.MULTIPLAYER_TEST_SECONDS)||5));
async function post(endpoint,body,cookie) {
 const response=await fetch(new URL('/api/multiplayer/'+endpoint,base),{method:'POST',headers:{'content-type':'application/json',origin:base.origin,...(cookie?{cookie}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const data=await response.json();return {response,data};
}
async function batches(items,fn) {for(let i=0;i<items.length;i+=16)await Promise.all(items.slice(i,i+16).map(fn));}
try {
 const lobby=await(await fetch(new URL('/api/multiplayer/lobby?room='+roomName,base))).json();assert(lobby.ok,'A configured local shared server is required.');
 const players=Math.min(lobby.population.capacity,Number(process.env.MULTIPLAYER_TEST_PLAYERS)||128);
 const start=performance.now();
 await batches(Array.from({length:players},(_,i)=>i),async i=>{
  const {response,data}=await post('connect',{roomName,mode:'multi_player',identity:{displayName:'Load Pilot '+i}});
  assert.equal(response.status,200,JSON.stringify(data));assert(data.token);
  const cookie=response.headers.getSetCookie().find(v=>v.startsWith('tcentral_guest_pilot=')).split(';')[0];
  sessions.push({id:data.player.id,token:data.token,roomName,cookie,frameIndex:data.player.frameIndex||0});
 });
 const admitted=await(await fetch(new URL('/api/multiplayer/lobby?room='+roomName,base))).json();assert.equal(admitted.population.playerCount,players);
 if(players===lobby.population.capacity){const excess=await post('connect',{roomName,mode:'multi_player',identity:{id:sessions[0].id}});assert.equal(excess.response.status,409);assert.equal(excess.data.error,'ROOM_FULL');assert.equal(excess.data.token,undefined);}
 const until=performance.now()+seconds*1000;let requests=0,bytes=0;
 await Promise.all(sessions.map(async session=>{
  while(performance.now()<until){
   const before=performance.now();
   const inputs=Array.from({length:15},(_,i)=>({frameIndex:session.frameIndex+i+1,dt:1/60,controlVector:[.1,0,.1]}));
   const {response,data}=await post('state',{roomName,id:session.id,token:session.token,mode:'multi_player',captureSimulationEvent:false,snapshot:{inputs}},session.cookie);
   assert.equal(response.status,200,JSON.stringify(data));assert.equal(data.state.playerCount,players);
   const self=data.state.players.find(p=>p.id===session.id);assert(self,'The roster must always include its requesting player.');assert(self.frameIndex>=session.frameIndex);
   session.frameIndex=self.frameIndex;samples.push(performance.now()-before);requests++;bytes+=Buffer.byteLength(JSON.stringify(data));
   await new Promise(resolve=>setTimeout(resolve,250));
  }
 }));
 samples.sort((a,b)=>a-b);
 console.log(JSON.stringify({backend:lobby.durable?'local PostgreSQL-compatible REST fixture':'single-process memory',pilots:players,configuredCapacity:lobby.population.capacity,requestedDurationSeconds:seconds,totalElapsedSeconds:+((performance.now()-start)/1000).toFixed(2),successfulStateRequests:requests,p50Ms:+samples[Math.floor(samples.length*.5)].toFixed(1),p95Ms:+samples[Math.min(samples.length-1,Math.floor(samples.length*.95))].toFixed(1),snapshotMiB:+(bytes/1024/1024).toFixed(2),rosterComplete:true,overflowRejected:players===lobby.population.capacity,productionCapacityVerified:false},null,2));
} finally {
 await batches(sessions,session=>post('disconnect',{roomName,id:session.id,token:session.token},session.cookie).catch(()=>{}));
}
