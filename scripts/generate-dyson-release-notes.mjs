import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

async function loadJson(relPath) {
  const raw = await fs.readFile(path.join(root, relPath), 'utf8');
  return JSON.parse(raw);
}

const continuity = await loadJson('data/dyson-continuity.manifest.json');
const progression = await loadJson('data/dyson-progression.manifest.json');

const lines = [
  '# Release Notes',
  '',
  `Build: ${progression.buildId}`,
  `Release Version: ${progression.releaseVersion}`,
  '',
  '## Dyson Sphere Continuity Verification',
  '',
];

for (const sphereId of continuity.canonicalSphereIds || []) {
  const sphere = progression?.spheres?.[sphereId] || {};
  lines.push(`- ${sphereId}`);
  lines.push(`  - stateVersion: ${sphere.stateVersion ?? 'missing'}`);
  lines.push(`  - contentDelta: ${sphere.contentDelta || 'missing'}`);
  lines.push(`  - simulationMilestone: ${sphere.simulationMilestone || 'missing'}`);
}

lines.push('');

const output = `${lines.join('\n')}\n`;
const outPath = path.join(root, 'RELEASE_NOTES.md');
await fs.writeFile(outPath, output, 'utf8');
console.log(output);
