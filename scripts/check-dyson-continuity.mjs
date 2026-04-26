import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

async function loadJson(relPath) {
  const fullPath = path.join(root, relPath);
  const raw = await fs.readFile(fullPath, 'utf8');
  return JSON.parse(raw);
}

function fail(issues) {
  console.error('Hub continuity gate failed:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

function hasForwardProgress(marker) {
  return Boolean(
    marker
      && Number.isFinite(Number(marker.stateVersion))
      && (String(marker.contentDelta || '').trim().length > 0 || String(marker.simulationMilestone || '').trim().length > 0)
  );
}

const continuity = await loadJson('data/dyson-continuity.manifest.json');
const worldState = await loadJson('data/world-state.manifest.json');
const missionGraph = await loadJson('data/mission-event-graph.manifest.json');
const simPipeline = await loadJson('data/simulation-pipeline.manifest.json');
const progression = await loadJson('data/dyson-progression.manifest.json');

const canonicalSphereIds = Array.isArray(continuity?.canonicalSphereIds) ? continuity.canonicalSphereIds : [];
const canonicalBlackholeIds = Array.isArray(continuity?.canonicalBlackholeServerIds) ? continuity.canonicalBlackholeServerIds : [];
const issues = [];

if (canonicalSphereIds.length !== 2) issues.push(`expected exactly 2 canonical Dyson sphere ids, found ${canonicalSphereIds.length}`);
if (canonicalBlackholeIds.length < 1) issues.push('expected at least 1 canonical blackhole server id');

for (const canonicalId of canonicalSphereIds) {
  const descriptor = continuity?.spheres?.[canonicalId];
  if (!descriptor) {
    issues.push(`missing sphere continuity descriptor for ${canonicalId}`);
    continue;
  }

  const worldHas = (worldState?.dysonSpheres || []).some((sphere) => sphere?.id === canonicalId && sphere?.nodeKey === descriptor.worldNodeKey);
  if (!worldHas) issues.push(`${canonicalId} missing in world state manifest`);

  const missionHas = (missionGraph?.graph?.nodes || []).some((node) => node?.sphereId === canonicalId && node?.id === descriptor.missionNodeId);
  if (!missionHas) issues.push(`${canonicalId} missing in mission/event graph manifest`);

  const simHas = (simPipeline?.tickPipeline?.stages || []).some((stage) => (stage?.sphereSources || []).includes(descriptor.pipelineSourceKey));
  if (!simHas) issues.push(`${canonicalId} missing in simulation tick/update pipeline manifest`);

  if (!hasForwardProgress(progression?.spheres?.[canonicalId])) {
    issues.push(`${canonicalId} missing forward progress marker (stateVersion + content delta or simulation milestone)`);
  }
}

for (const canonicalId of canonicalBlackholeIds) {
  const descriptor = continuity?.blackholeServers?.[canonicalId];
  if (!descriptor) {
    issues.push(`missing blackhole continuity descriptor for ${canonicalId}`);
    continue;
  }

  const worldHas = (worldState?.spawnedBlackholeServers || [])
    .some((node) => node?.id === canonicalId && node?.nodeKey === descriptor.worldNodeKey && node?.spawned === true);
  if (!worldHas) issues.push(`${canonicalId} missing in spawned blackhole world state manifest`);

  const missionHas = (missionGraph?.graph?.nodes || [])
    .some((node) => node?.blackholeServerId === canonicalId && node?.id === descriptor.missionNodeId);
  if (!missionHas) issues.push(`${canonicalId} missing in mission/event graph manifest`);

  const simHas = (simPipeline?.tickPipeline?.stages || [])
    .some((stage) => (stage?.serverBlackholeSources || []).includes(descriptor.pipelineSourceKey));
  if (!simHas) issues.push(`${canonicalId} missing in simulation tick/update pipeline manifest`);

  if (!hasForwardProgress(progression?.blackholeServers?.[canonicalId])) {
    issues.push(`${canonicalId} missing forward progress marker (stateVersion + content delta or simulation milestone)`);
  }
}

if (!Number.isFinite(Number(progression?.continuityStateVersion))) issues.push('progression manifest missing continuityStateVersion');
if (!String(progression?.buildId || '').trim()) issues.push('progression manifest missing buildId');

if (issues.length > 0) fail(issues);
console.log(`Hub continuity gate passed for ${canonicalSphereIds.length} Dyson spheres and ${canonicalBlackholeIds.length} spawned blackhole servers.`);
