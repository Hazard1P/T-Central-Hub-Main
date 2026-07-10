import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAP_DATA_ANCHOR,
  WORLD_LAYOUT,
  WORLD_MAP_DATA,
  WORLD_SUB_SECTOR_ASSETS,
  getWorldMapAssetByKey,
} from '../lib/worldLayout.js';

test('world map data exposes every layout node as a sub-sector asset anchored to the playable map', () => {
  assert.equal(WORLD_SUB_SECTOR_ASSETS.length, WORLD_LAYOUT.length);
  assert.equal(WORLD_MAP_DATA.anchor.key, 'solar_system');
  assert.equal(MAP_DATA_ANCHOR.key, WORLD_MAP_DATA.anchor.key);

  const solar = getWorldMapAssetByKey('solar_system');
  assert.deepEqual(solar.mapPosition, WORLD_MAP_DATA.anchor.mapPosition);
  assert.equal(solar.attachedTo, null);
  assert.equal(solar.playableAnchor, true);

  for (const node of WORLD_LAYOUT) {
    const asset = getWorldMapAssetByKey(node.key);
    assert.ok(asset, `${node.key} should have a sub-sector asset`);
    assert.deepEqual(asset.physicsPosition, node.position);
    assert.equal(asset.anchorKey, WORLD_MAP_DATA.anchor.key);
    assert.equal(asset.subSectorKey, `${WORLD_MAP_DATA.anchor.key}:${node.key}`);
  }
});

test('server blackholes and Dyson datapoints resolve as anchored sub-sector assets', () => {
  const arma = getWorldMapAssetByKey('arma3');
  const synaptics = getWorldMapAssetByKey('ss');
  const csis = getWorldMapAssetByKey('csis');

  assert.equal(arma.associatedServer, 'arma3-cth');
  assert.equal(arma.attachedTo, 'solar_system');
  assert.equal(arma.href, '/servers/arma3-cth');

  assert.equal(synaptics.kind, 'dyson');
  assert.equal(synaptics.attachedTo, 'solar_system');
  assert.ok(Array.isArray(synaptics.mapPosition));

  assert.equal(csis.kind, 'dyson');
  assert.equal(csis.external, true);
});


test('world simulation data does not expose MatrixCoinExchange as a playable route asset', () => {
  assert.equal(WORLD_LAYOUT.some((node) => node.key === 'matrixcoinexchange'), false);
  assert.equal(WORLD_MAP_DATA.subSectorAssets.some((asset) => asset.key === 'matrixcoinexchange'), false);
  assert.equal(getWorldMapAssetByKey('matrixcoinexchange'), null);
});
