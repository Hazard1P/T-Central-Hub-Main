import { sampleGravityField, createGravitySources } from '@/lib/physicsEngine';

export function buildGravitySources(graph) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  return createGravitySources(nodes.filter((node) => Array.isArray(node.position)));
}

export function sampleUniverseGravity({ graph, position }) {
  const sources = buildGravitySources(graph);
  return sampleGravityField({ position, sources });
}

export function computeTidalStress({ graph, position }) {
  const field = sampleUniverseGravity({ graph, position });
  const magnitude = Math.sqrt(field.acceleration[0] ** 2 + field.acceleration[1] ** 2 + field.acceleration[2] ** 2);
  return Number((magnitude * 0.45 + field.horizonStress * 0.8).toFixed(4));
}
