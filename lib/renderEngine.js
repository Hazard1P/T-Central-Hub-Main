export function getRenderTier({ isMobile = false, maximumRealism = true } = {}) {
  const realismScale = maximumRealism ? 1.8 : 1;
  return {
    stars: Math.round((isMobile ? 3200 : 6200) * realismScale),
    sparkles: Math.round((isMobile ? 70 : 180) * realismScale),
    meteors: Math.round((isMobile ? 8 : 16) * realismScale),
    dustOpacity: maximumRealism ? 0.18 : 0.1,
    routeOpacity: maximumRealism ? 0.62 : 0.38,
    distortionStrength: maximumRealism ? 1.2 : 0.8,
  };
}
