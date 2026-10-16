import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

// Run against a running local server: APP_SMOKE_BASE_URL=http://127.0.0.1:3000 node scripts/verify-pages.mjs
const base = new URL(process.env.APP_SMOKE_BASE_URL || 'http://127.0.0.1:3000');
const appRoot = path.join(process.cwd(), 'app');

async function discoverPages(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const pages = await Promise.all(entries.map(async (entry) => {
    if (entry.isDirectory()) return discoverPages(path.join(directory, entry.name));
    if (entry.name !== 'page.js') return [];
    const route = path.relative(appRoot, directory).split(path.sep).join('/');
    return route.includes('[') ? [] : [`/${route}`];
  }));
  return pages.flat();
}

const routes = await discoverPages(appRoot);
for (const route of routes) {
  let response = await fetch(new URL(route, base), { signal: AbortSignal.timeout(15000) });
  // Next can emit a streamed redirect for this legacy URL; verify its protected destination too.
  if (route === '/admin/dyson-assets' && response.status === 307) {
    response = await fetch(new URL('/admin/dyson', base), { signal: AbortSignal.timeout(15000) });
  }
  assert.equal(response.status, 200, `${route}: expected HTTP 200`);
  const html = await response.text();
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${route}: expected one main heading`);
  if (route !== '/system') assert.match(html, /aria-label="Main navigation"/, `${route}: shared navigation missing`);
  if (route.startsWith('/admin/')) assert.match(html, /Sign in before opening Dyson administration/, `${route}: guest authentication guard missing`);
  console.log(`PASS ${route}`);
}
console.log(`Verified ${routes.length} page routes and guest admin guards.`);
