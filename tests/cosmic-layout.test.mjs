import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_LAYOUT } from '../lib/worldLayout.js';
import { COSMIC_POSITIONS, COSMIC_STAR_SYSTEMS } from '../lib/cosmicLayout.js';
import { DOCK_OFFSET } from '../lib/celestialScale.js';
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
    assert.ok(node.position.every(value => Math.abs(value) < 1_000_000_000));
    if (node.key !== 'solar_system') assert.ok(distanceBetween(node.position,COSMIC_POSITIONS.solar_system)>100_000_000, 'deep space stays beyond the outer Solar System');
  });
  assert.deepEqual(COSMIC_POSITIONS.ss_dock.map((v,i)=>Number((v-COSMIC_POSITIONS.ss[i]).toFixed(2))),DOCK_OFFSET);
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
