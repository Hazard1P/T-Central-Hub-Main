// Fictional deep-space geometry uses one world scale, independent of quality,
// room, camera distance or quadrant. The physical Solar System is excluded.
export const COSMIC_BODY_SCALE = 4800;
export const DYSON_OUTER_RADIUS = 3.45 * COSMIC_BODY_SCALE;
export const BLACK_HOLE_RADIUS = 1.08 * .66 * COSMIC_BODY_SCALE;
export const BLACK_HOLE_DISK_RADIUS = BLACK_HOLE_RADIUS * 2.9;
export const DOCK_OFFSET = Object.freeze([18900, 7500, 8700]);

export function stellarCoreRadius(node = {}) {
  return 1.15 * (1.4 + Math.min((node.stellarProfile?.radiusSolar || 1) * .12, .35));
}

export function celestialMetrics(node = {}) {
  if (node.key === 'solar_system') return { renderScale: 1, radius: 3, clearanceRadius: 3, approachRadius: 12 };
  if (node.kind === 'blackhole') return { renderScale: COSMIC_BODY_SCALE, radius: BLACK_HOLE_RADIUS, clearanceRadius: BLACK_HOLE_DISK_RADIUS, approachRadius: BLACK_HOLE_DISK_RADIUS * 3 };
  if (node.kind === 'dyson') return { renderScale: COSMIC_BODY_SCALE, radius: DYSON_OUTER_RADIUS, clearanceRadius: DYSON_OUTER_RADIUS, approachRadius: DYSON_OUTER_RADIUS * 3 };
  if (node.kind === 'solar') {
    // A server obstacle without the generated stellar profile uses the largest
    // supported core, so it cannot underestimate the rendered surface.
    const radius = (node.stellarProfile ? stellarCoreRadius(node) : 1.15 * 1.75) * COSMIC_BODY_SCALE;
    const orbitExtent = node.orbiters?.length ? Math.max(...node.orbiters.map(orbit => Math.hypot(orbit.radius, orbit.tilt || 0) + orbit.size)) : 6.8;
    const clearanceRadius = Math.max(radius, orbitExtent * COSMIC_BODY_SCALE);
    return { renderScale: COSMIC_BODY_SCALE, radius, clearanceRadius, approachRadius: clearanceRadius * 3 + 12 };
  }
  if (node.kind === 'planet') {
    const clearanceRadius = node.radius * (node.rings || node.key === 'halcyon' ? 2.05 : 1.055);
    return { renderScale: 1, radius: node.radius, clearanceRadius, approachRadius: clearanceRadius * 3 + 8 };
  }
  if (node.structureProfile === 'private_map_asset') return { renderScale: 12000, radius: 24000, clearanceRadius: 24000, approachRadius: 36000 };
  if (node.kind === 'node') return { renderScale: 100, radius: node.structureProfile === 'docking_station' ? 180 : 150, clearanceRadius: 180, approachRadius: 450 };
  return { renderScale: 1, radius: node.radius || 1.5, clearanceRadius: node.radius || 1.5, approachRadius: node.approachRadius || 5 };
}
