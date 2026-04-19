import { WORLD_LAYOUT } from '@/lib/worldLayout';

export function getNodesByKind(kind) {
  return WORLD_LAYOUT.filter((node) => node.kind === kind);
}

export function getPrimaryRoutes() {
  return WORLD_LAYOUT.filter((node) => node.kind === 'blackhole' || node.kind === 'dyson');
}

export function getNodeByKey(key) {
  return WORLD_LAYOUT.find((node) => node.key === key) || null;
}
