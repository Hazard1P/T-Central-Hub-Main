import assert from 'node:assert/strict';

// Run against a local server. Creates an isolated test room and releases its sessions.
const base = new URL(process.env.APP_SMOKE_BASE_URL || 'http://127.0.0.1:3000');
const roomName = 'verify-explore-' + Date.now().toString(36);
const sessions = [];

async function post(endpoint, payload, browser = {}) {
  const response = await fetch(new URL('/api/multiplayer/' + endpoint, base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(browser.cookie ? { cookie: browser.cookie } : {}) },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  const guestCookie = response.headers.getSetCookie().find((value) => value.startsWith('tcentral_guest_pilot='));
  if (guestCookie) browser.cookie = guestCookie.split(';')[0];
  return { response, body: await response.json() };
}

async function join(browser, name, id = name) {
  const result = await post('connect', { roomName, mode: 'multi_player', identity: { id, displayName: name, authenticated: true } }, browser);
  assert.equal(result.response.status, 200);
  assert.equal(result.body.ok, true);
  const session = { roomName, id: result.body.player.id, token: result.body.token };
  sessions.push(session);
  return { ...session, player: result.body.player };
}

try {
  const atlasBrowser = {}, vegaBrowser = {};
  const atlas = await join(atlasBrowser, 'Atlas');
  const vega = await join(vegaBrowser, 'Vega');
  assert.notEqual(atlas.id, vega.id);
  assert.equal(atlas.player.authenticated, false, 'a client cannot self-declare authentication');
  assert.ok(atlasBrowser.cookie && vegaBrowser.cookie);
  assert.notEqual(atlasBrowser.cookie, vegaBrowser.cookie);
  const resumed = await join(vegaBrowser, 'Vega', atlas.id);
  assert.equal(resumed.id, vega.id, 'a public roster ID cannot claim another browser session');
  console.log('PASS independent guest credentials and cookie-bound rejoin.');

  await new Promise((resolve) => setTimeout(resolve, 260));
  const inputs = Array.from({ length: 15 }, (_, index) => ({ frameIndex: index + 1, dt: 1 / 60, controlVector: [0, 0, 1] }));
  const moved = await post('state', { ...atlas, snapshot: { inputs, position: [150, 0, 150] } }, atlasBrowser);
  assert.equal(moved.response.status, 200);
  const self = moved.body.state.players.find((pilot) => pilot.id === atlas.id);
  assert.equal(self.frameIndex, 15);
  assert.notDeepEqual(self.position, atlas.player.position);
  assert.ok(Math.hypot(self.position[0] - 150, self.position[2] - 150) > 100, 'the server ignores a client teleport');
  const observed = await post('state', { ...vega, snapshot: { inputs: [] } }, vegaBrowser);
  assert.equal(observed.body.state.playerCount, 2);
  assert.deepEqual(observed.body.state.players.find((pilot) => pilot.id === atlas.id).position, self.position);
  console.log('PASS authoritative input batches, teleport rejection and movement visible to another pilot.');

  const replay = await post('state', { ...atlas, snapshot: { inputs } }, atlasBrowser);
  assert.deepEqual(replay.body.state.players.find((pilot) => pilot.id === atlas.id).position, self.position);
  const unauthorized = await post('disconnect', { ...atlas, token: vega.token }, vegaBrowser);
  assert.equal(unauthorized.response.status, 401);
  const left = await post('disconnect', atlas, atlasBrowser);
  assert.equal(left.body.ok, true);
  const remaining = await post('state', { ...vega, snapshot: { inputs: [] } }, vegaBrowser);
  assert.equal(remaining.body.state.playerCount, 1);
  console.log('PASS replay protection, session ownership and immediate departure.');
} finally {
  for (const session of sessions) await post('disconnect', session).catch(() => {});
}
