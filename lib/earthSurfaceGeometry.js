import { SphereGeometry } from "three";
import { earthSurfaceHeight, EARTH_TERRAIN_SEGMENTS } from "./earthSurface.js";

export function createEarthSurfaceGeometry(radius) {
  const mesh = new SphereGeometry(
    1,
    EARTH_TERRAIN_SEGMENTS,
    EARTH_TERRAIN_SEGMENTS / 2,
  );
  const positions = mesh.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const direction = [positions.getX(i), positions.getY(i), positions.getZ(i)];
    const relief = 1 + earthSurfaceHeight(direction) / radius;
    positions.setXYZ(i, ...direction.map((v) => v * relief));
  }
  mesh.computeVertexNormals();
  return mesh;
}
