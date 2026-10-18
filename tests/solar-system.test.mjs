import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutSolarLabels } from '../lib/solarLabels.js';
import {
  AU_KM, SIDEREAL_DAY_SECONDS, GEO_RADIUS_KM, GEO_ALTITUDE_KM, SOLAR_BODIES, SOLAR_PLANETS,
  SUN_STELLAR_PROFILE, getSolarSystemState, solarBodyPosition, geostationaryState,
  solarDate, solarClockTime, sampleSolarOrbit, SOLAR_TIME_MIN, SOLAR_TIME_MAX,
} from '../lib/solarSystem.js';

const magnitude = (v) => Math.hypot(...v);
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const subtract = (a, b) => a.map((value, axis) => value - b[axis]);
const date = Date.parse('2026-10-18T12:00:00Z');

test('the main system has eight real planets, a fixed G2V Sun, Moon and dwarf planet Pluto', () => {
  assert.deepEqual(SOLAR_PLANETS.map((body) => body.name), ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']);
  assert.equal(SOLAR_BODIES.find((body) => body.id === 'pluto').type, 'dwarf planet');
  assert.equal(SOLAR_BODIES.find((body) => body.id === 'moon').parent, 'earth');
  assert.equal(SUN_STELLAR_PROFILE.massSolar, 1);
  assert.equal(SUN_STELLAR_PROFILE.radiusSolar, 1);
  assert.equal(SUN_STELLAR_PROFILE.temperatureK, 5772);
});

test('J2000 planetary positions agree with independent approximate JPL element reference values', () => {
  // JPL approximate-position elements (1800–2050), evaluated at J2000.
  // https://ssd.jpl.nasa.gov/planets/approx_pos.html
  // Render frame is [ecliptic x, ecliptic z, -ecliptic y]. This coarse reference
  // catches frame/sign/date errors without treating approximate elements as a precision ephemeris.
  const epoch = Date.parse('2000-01-01T12:00:00Z');
  const reference = { earth: [-.177171, 0, -.967214], mercury: [-.13009, -.02460, .44729], mars: [1.39066, -.03446, .01339] };
  for (const [id, expected] of Object.entries(reference)) assert.ok(magnitude(subtract(solarBodyPosition(id, epoch), expected)) < .001, id);
});

test('orbits preserve eccentricity, inclination, actual time and a common physical AU scale', () => {
  const jan = magnitude(solarBodyPosition('earth', Date.parse('2026-01-03T12:00:00Z')));
  const jul = magnitude(solarBodyPosition('earth', Date.parse('2026-07-04T12:00:00Z')));
  assert.ok(jan < .985 && jul > 1.015);
  const now = getSolarSystemState(date), later = getSolarSystemState(date + 86400000);
  const earth = now.find((body) => body.id === 'earth');
  assert.equal(earth.radiusAu * AU_KM, earth.radiusKm);
  const mercury = now.find((body) => body.id === 'mercury');
  assert.ok(Math.abs(mercury.position[1]) > .001, 'inclination is retained');
  assert.ok(magnitude(subtract(earth.position, later.find((body) => body.id === 'earth').position)) > .015);
  assert.deepEqual(getSolarSystemState(date).map((body) => body.position), now.map((body) => body.position), 'independent clients get the same positions for a UTC instant');
  const moonDistanceKm = magnitude(subtract(now.find((body) => body.id === 'moon').position, earth.position)) * AU_KM;
  assert.ok(moonDistanceKm > 350000 && moonDistanceKm < 410000, 'Moon follows Earth rather than independently orbiting the Sun');
});

test('all body orientation frames are orthonormal and Earth rotates at a sidereal rate', () => {
  for (const body of getSolarSystemState(date)) {
    const { x, y, z } = body.orientation;
    for (const axis of [x, y, z]) assert.ok(Math.abs(magnitude(axis) - 1) < 1e-12, body.name);
    for (const pair of [[x, y], [x, z], [y, z]]) assert.ok(Math.abs(dot(...pair)) < 1e-10, body.name);
  }
  const start = geostationaryState(date).relative;
  const sidereal = geostationaryState(date + SIDEREAL_DAY_SECONDS * 1000).relative;
  const solarDay = geostationaryState(date + 86400000).relative;
  assert.ok(magnitude(subtract(start, sidereal)) / magnitude(start) < .00001);
  const angle = Math.acos(dot(start, solarDay) / (magnitude(start) * magnitude(solarDay))) * 180 / Math.PI;
  assert.ok(angle > .9 && angle < 1.1, 'a sidereal orbit must not mistakenly take 24 hours');
});

test('GEO obeys Kepler’s circular-orbit radius and stays over its chosen Earth longitude', () => {
  assert.ok(Math.abs(GEO_ALTITUDE_KM - 35786) < 1);
  const period = 2 * Math.PI * Math.sqrt(GEO_RADIUS_KM ** 3 / 398600.4418);
  assert.ok(Math.abs(period - SIDEREAL_DAY_SECONDS) < 1e-8);
  for (const longitude of [-180, -123, 0, 45, 180]) {
    for (const delta of [0, 3600000, 86400000, 86400000 * 30]) {
      const time = date + delta;
      const geo = geostationaryState(time, longitude);
      const earth = getSolarSystemState(time).find((body) => body.id === 'earth');
      assert.ok(Math.abs(magnitude(geo.relative) * AU_KM - GEO_RADIUS_KM) < 1e-8);
      assert.ok(Math.abs(dot(geo.relative, earth.orientation.y)) < 1e-10);
      const localX = dot(geo.relative, earth.orientation.x), localZ = dot(geo.relative, earth.orientation.z);
      const actual = Math.atan2(-localZ, localX) * 180 / Math.PI;
      const difference = ((actual - longitude + 540) % 360) - 180;
      assert.ok(Math.abs(difference) < 1e-7);
    }
  }
});

test('clock rates use elapsed monotonic time, remain independent of frame count and stop at model limits', () => {
  const clock = { anchorUtcMs: date, anchorMonotonicMs: 500, rate: 86400 };
  assert.equal(solarClockTime(clock, 1500), date + 86400000);
  assert.equal(solarClockTime({ ...clock, rate: 0 }, 999999), date);
  assert.equal(solarClockTime({ ...clock, anchorUtcMs: SOLAR_TIME_MAX - 1 }, 1500), SOLAR_TIME_MAX);
  assert.equal(solarClockTime({ ...clock, anchorUtcMs: SOLAR_TIME_MIN, rate: -1 }, 1500), SOLAR_TIME_MIN);
  for (const input of ['invalid', Date.UTC(1600, 0, 1), Date.UTC(2300, 0, 1), NaN]) assert.throws(() => solarDate(input), RangeError);
  assert.throws(() => geostationaryState(date, 181), RangeError);
});

test('orbit guides sample actual positions, and the lunar guide is Earth-centered', () => {
  const earth = SOLAR_PLANETS.find((body) => body.id === 'earth');
  const points = sampleSolarOrbit(earth, date, 24);
  assert.equal(points.length, 25);
  assert.deepEqual(points[12], solarBodyPosition('earth', date));
  const moon = sampleSolarOrbit(SOLAR_BODIES.find((body) => body.id === 'moon'), date, 24);
  assert.ok(moon.every((point) => magnitude(point) < .003));
});

test('overlapping inner-planet labels separate without moving their astronomical anchors', () => {
  for (const [width, height] of [[1440, 1000], [320, 740]]) {
    const points = Array.from({ length: 10 }, (_, id) => ({ id, px: width / 2, py: height / 2 }));
    const labels = layoutSolarLabels(points, width, height);
    assert.equal(labels.length, 10);
    for (const label of labels) {
      assert.equal(label.px, width / 2); assert.equal(label.py, height / 2);
      assert.ok(label.x >= 0 && label.x + 80 <= width);
      assert.ok(label.y >= 100 && label.y + 22 <= height - 125);
      for (const other of labels.filter((entry) => entry.id !== label.id)) assert.ok(Math.abs(label.x - other.x) >= 85 || Math.abs(label.y - other.y) >= 27);
    }
  }
});
