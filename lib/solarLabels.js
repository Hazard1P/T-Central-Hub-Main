// Labels may move; their projected astronomical anchor points never do.
export function layoutSolarLabels(points, width, height) {
  const boxWidth = 80, boxHeight = 22, gap = 5;
  const top = width <= 820 ? 145 : 105, bottom = height - 125;
  const placed = [];
  const offsets = [];
  for (const dx of [0, -100, 100, -200, 200]) {
    for (let step = -6; step <= 6; step += 1) offsets.push([dx, step * 28]);
  }
  offsets.sort((a, b) => a[0] ** 2 + a[1] ** 2 - b[0] ** 2 - b[1] ** 2);
  for (const point of points) {
    let chosen;
    for (const [dx, dy] of offsets) {
      const candidate = {
        ...point,
        x: Math.max(8, Math.min(width - boxWidth - 8, point.px + 10 + dx)),
        y: Math.max(top, Math.min(bottom - boxHeight, point.py - boxHeight / 2 + dy)),
      };
      if (!placed.some((other) => Math.abs(candidate.x - other.x) < boxWidth + gap && Math.abs(candidate.y - other.y) < boxHeight + gap)) { chosen = candidate; break; }
    }
    if (!chosen) continue; // All destinations remain available in the navigation strip.
    chosen.lineX = chosen.x > point.px ? chosen.x : chosen.x + boxWidth;
    chosen.lineY = chosen.y + boxHeight / 2;
    placed.push(chosen);
  }
  return placed;
}
