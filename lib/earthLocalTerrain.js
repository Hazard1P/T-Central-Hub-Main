import { BufferGeometry, BufferAttribute } from "three";
import { earthSurfaceHeight, earthLandCoverage } from "./earthSurface.js";
import { METRES_PER_UNIT, normal } from "./earthWalk.js";

// A bounded tangent tile in Earth-local coordinates. Vertices stay near zero,
// preserving eye-height detail without float32 jitter from the global orbit.
export function localTerrainFrame(anchor, radius) {
  const unit = normal(anchor),
    pole = Math.abs(unit[1]) > 0.98 ? [1, 0, 0] : [0, 1, 0];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const right = normal(cross(pole, unit)),
    north = normal(cross(unit, right));
  const center = unit.map((v) => v * (radius + earthSurfaceHeight(unit)));
  return { unit, right, north, center };
}
export function createLocalEarthTerrain(
  anchor,
  radius,
  spanMetres = 6000,
  segments = 96,
) {
  const frame = localTerrainFrame(anchor, radius),
    positions = [],
    uv = [],
    localDirections = [],
    indices = [];
  for (let z = 0; z <= segments; z++)
    for (let x = 0; x <= segments; x++) {
      const dx = ((x / segments - 0.5) * spanMetres) / METRES_PER_UNIT,
        dz = ((z / segments - 0.5) * spanMetres) / METRES_PER_UNIT;
      const direction = normal(
        frame.unit.map(
          (v, i) => v + (frame.right[i] * dx + frame.north[i] * dz) / radius,
        ),
      );
      const h = radius + earthSurfaceHeight(direction);
      positions.push(...direction.map((v, i) => v * h - frame.center[i]));
      localDirections.push(...direction);
      uv.push(x / segments, z / segments);
    }
  for (let z = 0; z < segments; z++)
    for (let x = 0; x < segments; x++) {
      const a = z * (segments + 1) + x,
        b = a + 1,
        c = a + segments + 1,
        d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  const mesh = new BufferGeometry();
  mesh.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  mesh.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
  mesh.setAttribute(
    "earthDirection",
    new BufferAttribute(new Float32Array(localDirections), 3),
  );
  mesh.setIndex(indices);
  mesh.computeVertexNormals();
  return {
    geometry: mesh,
    frame,
    spanMetres,
    land: earthLandCoverage(frame.unit),
  };
}
