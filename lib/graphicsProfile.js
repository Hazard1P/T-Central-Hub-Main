// Keep resolution and expensive effects bounded independently of the simulation tick.
export function getGraphicsProfile(quality = 'auto', { isMobile = false, reducedMotion = false } = {}) {
  const performance = quality === 'performance' || (quality !== 'high' && isMobile);
  return {
    dpr: performance ? [1, 1] : [1, 1.6],
    bloom: !performance,
    stars: performance ? 1800 : 5200,
    asteroids: performance ? 28 : 80,
    clouds: !performance,
    segments: performance ? 32 : 64,
    animate: !reducedMotion,
  };
}
