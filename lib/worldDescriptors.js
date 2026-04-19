import { WORLD_LAYOUT, WORLD_SUMMARY } from '@/lib/worldLayout';

export function getWorldHeadline() {
  return `${WORLD_SUMMARY.blackholes} blackholes • ${WORLD_SUMMARY.dysonSpheres} Dyson spheres • ${WORLD_SUMMARY.solarSystems} solar system • ${WORLD_SUMMARY.nodes} relay nodes`;
}

export function getFeaturedRoutes() {
  return WORLD_LAYOUT
    .filter((node) => ['blackhole', 'dyson', 'solar'].includes(node.kind))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .slice(0, 6);
}

export function getKindLabel(kind) {
  if (kind === 'blackhole') return 'Blackhole';
  if (kind === 'dyson') return 'Dyson sphere';
  if (kind === 'solar') return 'Solar system';
  if (kind === 'node') return 'Node';
  return 'Route';
}
