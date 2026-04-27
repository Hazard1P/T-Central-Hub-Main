import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

async function loadJson(relPath) {
  const fullPath = path.join(root, relPath);
  const raw = await fs.readFile(fullPath, 'utf8');
  return JSON.parse(raw);
}

async function loadJsonIfPresent(relPath) {
  try {
    return await loadJson(relPath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
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
const crossref = await loadJsonIfPresent('data/dyson-crossref.manifest.json');

const canonicalIds = Array.isArray(continuity?.canonicalSphereIds) ? continuity.canonicalSphereIds : [];
const issues = [];
const stages = simPipeline?.tickPipeline?.stages || [];
const requiredStagePrefixes = ['gravity_sources', 'mission_integrations'];
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

const missionNodesBySphere = new Map();
const descriptorsBySphere = new Map();

for (const canonicalId of canonicalIds) {
  const descriptor = continuity?.spheres?.[canonicalId];
  if (!descriptor) {
    issues.push(`missing continuity descriptor for ${canonicalId}`);
    continue;
  }

  descriptorsBySphere.set(canonicalId, descriptor);

  const worldHasSphere = (worldState?.dysonSpheres || []).some((sphere) => sphere?.id === canonicalId && sphere?.nodeKey === descriptor.worldNodeKey);
  if (!worldHasSphere) issues.push(`${canonicalId} missing in world state manifest`);

  const missionHasSphere = (missionGraph?.graph?.nodes || []).some((node) => node?.sphereId === canonicalId && node?.id === descriptor.missionNodeId);
  if (!missionHasSphere) issues.push(`${canonicalId} missing in mission/event graph manifest`);
  missionNodesBySphere.set(canonicalId, descriptor.missionNodeId);

  const stageNamesForSphere = stages
    .filter((stage) => (stage?.sphereSources || []).includes(descriptor.pipelineSourceKey))
    .map((stage) => String(stage?.name || ''));

  if (stageNamesForSphere.length === 0) {
    issues.push(`${canonicalId} missing in simulation tick/update pipeline manifest`);
  }

  for (const requiredPrefix of requiredStagePrefixes) {
    const hasRequiredStage = stageNamesForSphere.some((name) => name === requiredPrefix || name.startsWith(`${requiredPrefix}_`));
    if (!hasRequiredStage) {
      issues.push(`${canonicalId} missing ${requiredPrefix} stage in simulation tick/update pipeline manifest`);
    }
  }

  const stageSuffix = canonicalId.split('.').pop();
  const expectedStagePrefixes = ['gravity_sources', 'mission_integrations'];
  for (const stagePrefix of expectedStagePrefixes) {
    const stageName = `${stagePrefix}_${stageSuffix}`;
    const stage = (simPipeline?.tickPipeline?.stages || []).find((entry) => entry?.name === stageName);
    if (!stage) {
      issues.push(`${canonicalId} missing split stage ${stageName}`);
      continue;
    }

    const sources = Array.isArray(stage?.sphereSources) ? stage.sphereSources : [];
    if (sources.length !== 1 || sources[0] !== descriptor.pipelineSourceKey) {
      issues.push(`${stageName} must exclusively source ${descriptor.pipelineSourceKey}`);
    }
  }

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

const missionEdges = Array.isArray(missionGraph?.graph?.edges) ? missionGraph.graph.edges : [];
for (const edge of missionEdges) {
  const fromSphere = canonicalIds.find((sphereId) => missionNodesBySphere.get(sphereId) === edge?.from);
  const toSphere = canonicalIds.find((sphereId) => missionNodesBySphere.get(sphereId) === edge?.to);
  if (fromSphere && toSphere && fromSphere !== toSphere) {
    issues.push(`mission graph contains hard dependency edge across spheres: ${edge.from} -> ${edge.to}`);
  }
}

if (!Number.isFinite(Number(progression?.continuityStateVersion))) {
  issues.push('progression manifest missing continuityStateVersion');
}

if (!String(progression?.buildId || '').trim()) {
  issues.push('progression manifest missing buildId');
}

if (crossref) {
  const links = Array.isArray(crossref?.links) ? crossref.links : [];
  if (!Array.isArray(crossref?.links)) {
    issues.push('crossref manifest links must be an array when present');
  }

  for (const [index, link] of links.entries()) {
    const fromSphereId = link?.fromSphereId;
    const toSphereId = link?.toSphereId;
    const mode = link?.mode;

    if (!canonicalIds.includes(fromSphereId)) {
      issues.push(`crossref link[${index}] has unknown fromSphereId ${String(fromSphereId)}`);
    }

    if (!canonicalIds.includes(toSphereId)) {
      issues.push(`crossref link[${index}] has unknown toSphereId ${String(toSphereId)}`);
    }

    if (fromSphereId === toSphereId) {
      issues.push(`crossref link[${index}] cannot self-reference sphere ${String(fromSphereId)}`);
    }

    if (mode !== 'read_only') {
      issues.push(`crossref link[${index}] must declare mode=read_only`);
    }

    if (fromSphereId && toSphereId) {
      const fromNode = descriptorsBySphere.get(fromSphereId)?.missionNodeId;
      const toNode = descriptorsBySphere.get(toSphereId)?.missionNodeId;
      const hasHardEdge = missionEdges.some((edge) => edge?.from === fromNode && edge?.to === toNode);
      if (hasHardEdge) {
        issues.push(`crossref link[${index}] duplicates hard mission dependency ${String(fromNode)} -> ${String(toNode)}`);
      }
    }
  }
}

if (issues.length > 0) fail(issues);
console.log(`Dyson continuity gate passed for ${canonicalIds.length} canonical spheres${crossref ? ' with optional crossref checks' : ''}.`);
