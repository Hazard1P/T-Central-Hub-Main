import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FALLBACK_DONATION_ANCHOR,
  FALLBACK_DONATION_SOLAR_SYSTEM,
  getDonationRouteOptions,
} from '../lib/donationRouteOptions.js';

test('donation route options are generated from world layout route data', () => {
  const { blackholeAnchors, solarSystems } = getDonationRouteOptions();
  const anchorSlugs = blackholeAnchors.map((anchor) => anchor.anchorSlug);
  const solarSystemKeys = solarSystems.map((system) => system.solarSystemKey);

  assert.ok(anchorSlugs.includes('deep_blackhole'));
  assert.ok(anchorSlugs.includes('arma3-cth'));
  assert.ok(!anchorSlugs.includes('matrixcoinexchange'));
  assert.ok(solarSystemKeys.includes('solar_system'));

  const armaAnchor = blackholeAnchors.find((anchor) => anchor.anchorSlug === 'arma3-cth');
  assert.equal(armaAnchor.label, 'Arma3 CTH');
  assert.equal(armaAnchor.category, 'blackhole');
  assert.equal(armaAnchor.route.href, '/servers/arma3-cth');
  assert.equal(armaAnchor.route.targetServerId, 'arma3-cth-primary');
});

test('donation route options retain deep blackhole and solar system fallbacks when shared data is unavailable', () => {
  const { blackholeAnchors, solarSystems } = getDonationRouteOptions({ nodes: null, servers: null });

  assert.deepEqual(blackholeAnchors, [FALLBACK_DONATION_ANCHOR]);
  assert.deepEqual(solarSystems, [FALLBACK_DONATION_SOLAR_SYSTEM]);
});
