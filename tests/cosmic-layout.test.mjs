import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_LAYOUT } from '../lib/worldLayout.js';
import { COSMIC_POSITIONS, COSMIC_STAR_SYSTEMS, shouldTransferToSolar, SOLAR_TRANSFER_RADIUS } from '../lib/cosmicLayout.js';
import { buildGravitySourcesFromSeed, stepFrame } from '../lib/simCore/stepFrame.js';
import { distanceBetween, getApproachPoint, getCruiseControl, getExplorationDestinations } from '../lib/exploration.js';

test('stars, Dyson spheres and black holes occupy distinct, reachable regions around spawn', () => {
  const cosmic = WORLD_LAYOUT.filter(node => ['solar','dyson','blackhole'].includes(node.kind));
  for (const axis of [0,1,2]) {
    const positions = cosmic.map(node => node.position[axis]);
    assert.ok(Math.max(...positions)-Math.min(...positions) > (axis === 1 ? 100 : 200));
  }
  assert.ok(cosmic.filter(node=>node.kind==='solar').length>=5);
  assert.equal(COSMIC_STAR_SYSTEMS.length,4);
  cosmic.forEach(node => {
    assert.ok(distanceBetween([0,0,18],node.position)>35, `${node.key} leaves spawn clear`);
    assert.ok(Math.abs(node.position[0])<=140 && Math.abs(node.position[1])<=80 && Math.abs(node.position[2])<=140);
  });
  assert.deepEqual(COSMIC_POSITIONS.ss_dock.map((v,i)=>Number((v-COSMIC_POSITIONS.ss[i]).toFixed(2))),[3.15,1.25,1.45]);
});

test('static rendered anchors, navigation and gravity use identical coordinates across room seeds', () => {
  const a=buildGravitySourcesFromSeed('layout-a'),b=buildGravitySourcesFromSeed('layout-b');
  const destinations=getExplorationDestinations(WORLD_LAYOUT);
  a.forEach(source=>{
    const node=WORLD_LAYOUT.find(node=>node.key===source.key);
    assert.ok(node,source.key);
    assert.deepEqual(source.position,node.position);
    assert.deepEqual(b.find(s=>s.key===source.key).position,node.position);
    const destination=destinations.find(d=>d.key===source.key);
    if(destination) assert.deepEqual(destination.position,node.position);
  });
});

test('normal cruise reaches the automatic Solar System handoff using actual flight physics', () => {
  const solar=getExplorationDestinations(WORLD_LAYOUT).find(n=>n.key==='solar_system');
  let state={position:[0,0,18],velocity:[0,0,0],gravity:[0,0,0]};
  const target=getApproachPoint(state.position,solar),gravitySources=buildGravitySourcesFromSeed('solar-approach');
  let crossed=false;
  for(let frame=0;frame<2400;frame++){
    const controlVector=getCruiseControl({...state,target});
    state=stepFrame({...state,controlVector,gravitySources,dt:1/60});
    if(shouldTransferToSolar(state.position)){crossed=true;break;}
  }
  assert.equal(crossed,true);
  assert.ok(distanceBetween(state.position,solar.position)<=SOLAR_TRANSFER_RADIUS);
});

test('automatic handoff cannot repeat in a Solar region or interrupt a panel/encounter',()=>{
  const position=[...COSMIC_POSITIONS.solar_system];
  assert.equal(shouldTransferToSolar(position),true);
  assert.equal(shouldTransferToSolar(position,{inSolar:true}),false);
  assert.equal(shouldTransferToSolar(position,{blocked:true}),false);
  assert.equal(shouldTransferToSolar([0,0,18]),false);
  assert.equal(shouldTransferToSolar([NaN,0,0]),false);
});
