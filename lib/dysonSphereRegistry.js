import { computeCsisDysonState, summarizeCsisDysonState } from '@/lib/csisDysonSphereEngine';
import { computeSynapticsDysonState, summarizeSynapticsDysonState } from '@/lib/synapticsDysonSphereEngine';

const DYSON_SPHERE_REGISTRY = {
  'dyson.csis': {
    id: 'dyson.csis',
    legacySourceKey: 'dyson_csis',
    compute: computeCsisDysonState,
    summarize: summarizeCsisDysonState,
  },
  'dyson.synaptics': {
    id: 'dyson.synaptics',
    legacySourceKey: 'dyson_synaptics',
    compute: computeSynapticsDysonState,
    summarize: summarizeSynapticsDysonState,
  },
};

const DYSON_SPHERE_ALIAS_TO_ID = {
  dyson_csis: 'dyson.csis',
  dyson_synaptics: 'dyson.synaptics',
};

export function normalizeDysonSphereId(sphereId) {
  if (!sphereId) return null;
  return DYSON_SPHERE_ALIAS_TO_ID[sphereId] || sphereId;
}

export function getDysonSphereRegistry() {
  return DYSON_SPHERE_REGISTRY;
}

export function resolveDysonSphere(sphereId) {
  const canonicalId = normalizeDysonSphereId(sphereId);
  return canonicalId ? DYSON_SPHERE_REGISTRY[canonicalId] || null : null;
}

export function computeDysonSphereState(sphereId, input) {
  const sphere = resolveDysonSphere(sphereId);
  if (!sphere) return null;
  return sphere.compute(input);
}

export function summarizeDysonSphereState(sphereId, state) {
  const sphere = resolveDysonSphere(sphereId);
  if (!sphere) return null;
  return sphere.summarize(state);
}

export function computeRegisteredDysonStates({ sphereIds = [], input } = {}) {
  return sphereIds.reduce((acc, sphereId) => {
    const canonicalId = normalizeDysonSphereId(sphereId);
    const sphere = resolveDysonSphere(canonicalId);
    if (!canonicalId || !sphere) return acc;
    const state = sphere.compute(input);
    acc[canonicalId] = sphere.summarize(state);
    return acc;
  }, {});
}
