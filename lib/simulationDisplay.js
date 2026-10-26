export function visibleSimulationViewport({
  width = 1280,
  height = 720,
  visual = null,
  coarse = false,
  reducedMotion = false,
  dpr = 1,
} = {}) {
  const positive = (value, fallback) =>
    Number.isFinite(value) && value > 0 ? value : fallback;
  return {
    width: positive(visual?.width, positive(width, 1280)),
    height: positive(visual?.height, positive(height, 720)),
    left: Math.max(0, Number(visual?.offsetLeft) || 0),
    top: Math.max(0, Number(visual?.offsetTop) || 0),
    isMobile: coarse || width <= 820,
    reducedMotion,
    devicePixelRatio: positive(dpr, 1),
  };
}

export function simulationPixelRatio({
  width,
  height,
  devicePixelRatio = 1,
  isMobile = false,
  quality = "auto",
  scale = 1,
}) {
  const budget =
    quality === "high" ? 2_000_000 : isMobile ? 900_000 : 2_000_000;
  const maximum =
    quality === "performance" || (isMobile && quality === "auto") ? 1 : 1.6;
  const pixels = Math.max(1, width * height);
  return Math.max(
    0.25,
    Math.min(devicePixelRatio, maximum, Math.sqrt(budget / pixels)) * scale,
  );
}

// Hysteresis prevents resolution from oscillating around one expensive frame.
export function adaptiveResolutionScale(
  scale,
  averageFrameMs,
  recoveringSeconds = 0,
) {
  if (averageFrameMs > 36)
    return Math.max(0.6, Math.round((scale - 0.1) * 100) / 100);
  if (averageFrameMs < 21 && recoveringSeconds >= 8)
    return Math.min(1, Math.round((scale + 0.05) * 100) / 100);
  return scale;
}
