import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

async function loadJson(relPath) {
  const fullPath = path.join(root, relPath);
  const raw = await fs.readFile(fullPath, 'utf8');
  return JSON.parse(raw);
}

function fail(issues) {
  console.error('Dyson continuity gate failed:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

const continuity = await loadJson('data/dyson-continuity.manifest.json');
const worldState = await loadJson('data/world-state.manifest.json');
const missionGraph = await loadJson('data/mission-event-graph.manifest.json');
const simPipeline = await loadJson('data/simulation-pipeline.manifest.json');
const progression = await loadJson('data/dyson-progression.manifest.json');

const canonicalIds = Array.isArray(continuity?.canonicalSphereIds) ? continuity.canonicalSphereIds : [];
const issues = [];
const missionNodesById = new Map((missionGraph?.graph?.nodes || []).map((node) => [node?.id, node]));

for (const edge of missionGraph?.graph?.edges || []) {
  const fromNode = missionNodesById.get(edge?.from);
  const toNode = missionNodesById.get(edge?.to);
  const isCrossSphere = Boolean(fromNode?.sphereId && toNode?.sphereId && fromNode.sphereId !== toNode.sphereId);
  if (!isCrossSphere) continue;

  const requires = Array.isArray(edge?.requires) ? edge.requires.filter((flag) => typeof flag === 'string' && flag.trim()) : [];
  const optional = edge?.optional === true;
  if (!optional || requires.length === 0) {
    issues.push(
      `cross-sphere mission edge ${edge?.from || 'unknown'} -> ${edge?.to || 'unknown'} (${edge?.event || 'event:unknown'}) must be optional and gated with at least one explicit requires flag`
    );
  }
}

if (canonicalIds.length !== 2) issues.push(`expected exactly 2 canonical sphere ids, found ${canonicalIds.length}`);

for (const canonicalId of canonicalIds) {
  const descriptor = continuity?.spheres?.[canonicalId];
  if (!descriptor) {
    issues.push(`missing continuity descriptor for ${canonicalId}`);
    continue;
  }

  const worldHasSphere = (worldState?.dysonSpheres || []).some((sphere) => sphere?.id === canonicalId && sphere?.nodeKey === descriptor.worldNodeKey);
  if (!worldHasSphere) issues.push(`${canonicalId} missing in world state manifest`);

  const missionHasSphere = (missionGraph?.graph?.nodes || []).some((node) => node?.sphereId === canonicalId && node?.id === descriptor.missionNodeId);
  if (!missionHasSphere) issues.push(`${canonicalId} missing in mission/event graph manifest`);

  const simHasSphere = (simPipeline?.tickPipeline?.stages || []).some((stage) => (stage?.sphereSources || []).includes(descriptor.pipelineSourceKey));
  if (!simHasSphere) issues.push(`${canonicalId} missing in simulation tick/update pipeline manifest`);

  const marker = progression?.spheres?.[canonicalId];
  const hasForwardProgress = Boolean(
    marker
      && Number.isFinite(Number(marker.stateVersion))
      && (String(marker.contentDelta || '').trim().length > 0 || String(marker.simulationMilestone || '').trim().length > 0)
  );
  if (!hasForwardProgress) {
    issues.push(`${canonicalId} missing forward progress marker (stateVersion + content delta or simulation milestone)`);
  }
}

if (!Number.isFinite(Number(progression?.continuityStateVersion))) {
  issues.push('progression manifest missing continuityStateVersion');
}

if (!String(progression?.buildId || '').trim()) {
  issues.push('progression manifest missing buildId');
}

if (issues.length > 0) fail(issues);
console.log(`Dyson continuity gate passed for ${canonicalIds.length} canonical spheres.`);
