import assert from 'node:assert/strict';

const base = process.env.APP_SMOKE_BASE_URL || 'http://127.0.0.1:3700';
const started = Date.now();
const response = await fetch(new URL('/api/astronomy/time', base));
const result = await response.json();
assert.equal(response.status, 200);
assert.match(response.headers.get('cache-control'), /no-store/);
assert.equal(Date.parse(result.utc), result.unixMs);
assert.equal(result.unixSeconds, Math.floor(result.unixMs / 1000));
assert.ok(result.unixMs >= started - 5000 && result.unixMs <= Date.now() + 5000, 'server UTC is within the test clock uncertainty');
const second = await (await fetch(new URL('/api/astronomy/time', base))).json();
assert.ok(second.unixMs >= result.unixMs);
const legacy = await fetch(new URL('/system/solar-system', base), { redirect: 'manual' });
assert.equal(legacy.status, 307);
assert.equal(legacy.headers.get('location'), '/system?region=solar&body=earth');
for (const [route, expected] of [['/system', 'Launch simulation'], ['/system?region=solar&body=earth', 'Launch simulation']]) {
  const page = await fetch(new URL(route, base));
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes(expected));
}
console.log('Solar System smoke passed: uncached server UTC, consistent Unix/ISO time, advancing clock, launcher and legacy redirect into ship flight.');
