import { earthLandCoverage, earthSurfaceHeight } from "./earthSurface.js";
import { KM_PER_UNIT } from "./physics/mechanics.js";
const metres = KM_PER_UNIT * 1000,
  cellMetres = 48,
  cache = new Map();
const unit = (lat, lon) => [
  Math.cos(lat) * Math.cos(lon),
  Math.sin(lat),
  -Math.cos(lat) * Math.sin(lon),
];
export function earthNatureCell(anchor, radius) {
  const step = cellMetres / (radius * metres);
  return {
    step,
    row: Math.floor(
      (Math.asin(Math.max(-1, Math.min(1, anchor[1]))) + Math.PI / 2) / step,
    ),
    column: Math.floor((Math.atan2(-anchor[2], anchor[0]) + Math.PI) / step),
  };
}
export function earthNatureTile(anchor, radius) {
  if (Math.abs(anchor[1]) > Math.sin((85 * Math.PI) / 180))
    return { anchor: [...anchor], props: [], key: "polar" };
  const { step, row, column } = earthNatureCell(anchor, radius),
    key = row + ":" + column + ":" + radius;
  if (cache.has(key)) return cache.get(key);
  const lat = (row + 0.5) * step - Math.PI / 2,
    lon = (column + 0.5) * step - Math.PI,
    centerAnchor = unit(lat, lon),
    props = [];
  for (let dz = -2; dz <= 2; dz++)
    for (let dx = -2; dx <= 2; dx++) {
      let seed = (((row + dz) * 73856093) ^ ((column + dx) * 19349663)) >>> 0;
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      for (let i = 0; i < 8; i++) {
        const a = (row + dz + random()) * step - Math.PI / 2,
          b = (column + dx + random()) * step - Math.PI;
        if (Math.abs(a) > Math.PI / 2) continue;
        const direction = unit(a, b);
        if (earthLandCoverage(direction) < 0.8) continue;
        const rocky = i < 6 || Math.abs(a) > 1.1,
          dry = Math.abs(a) < 0.6;
        const height = rocky
          ? 0.18 + random() * 0.65
          : dry
            ? 0.4 + random() * 0.8
            : 3 + random() * 4;
        props.push({
          direction,
          kind: rocky ? "rock" : "plant",
          height,
          radius: rocky ? height * 0.8 : 0.2,
          rotation: random() * Math.PI * 2,
        });
      }
    }
  const tile = { anchor: centerAnchor, props, key };
  cache.set(key, tile);
  if (cache.size > 256) cache.delete(cache.keys().next().value);
  return tile;
}
export function earthNatureBlocked(anchor, radius) {
  return earthNatureTile(anchor, radius).props.some((prop) => {
    const threshold = (prop.radius + 0.28) / (metres * radius);
    return (
      anchor.reduce((s, v, i) => s + (v - prop.direction[i]) ** 2, 0) <
      threshold * threshold
    );
  });
}
