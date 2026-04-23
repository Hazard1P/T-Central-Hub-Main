import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const apiRoot = path.join(root, 'app', 'api');
const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && entry.name === 'route.js' ? [full] : [];
  }));
  return files.flat();
}

const routeFiles = await walk(apiRoot);
const issues = [];

for (const file of routeFiles) {
  const rel = path.relative(root, file);
  const src = await fs.readFile(file, 'utf8');
  const handlers = methods.filter((method) => new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`).test(src));

  if (handlers.length === 0) {
    issues.push(`${rel}: no HTTP route handler export found`);
  }
}

if (issues.length > 0) {
  console.error('API route verification failed:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Verified ${routeFiles.length} API route files with explicit HTTP handlers.`);
