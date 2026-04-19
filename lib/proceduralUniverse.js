const CORE_COLORS = ['#7fe7ff', '#9f7cff', '#6dffb5', '#ffd46b', '#ff9fd9', '#9dd0ff'];

function round(value) {
  return Number(value.toFixed(3));
}

export function createOrbiters({ key, count = 7, baseRadius = 2.5, radiusStep = 0.9 }) {
  return Array.from({ length: count }, (_, index) => ({
    key: `${key}-orbiter-${index + 1}`,
    radius: round(baseRadius + index * radiusStep),
    size: round(0.14 + index * 0.04),
    speed: round(0.12 + index * 0.022),
    tilt: round(((index % 3) - 1) * 0.19),
    seedAngle: round((Math.PI * 2 * index) / count),
    color: CORE_COLORS[index % CORE_COLORS.length],
  }));
}

export function enrichUniverseGraph(graph) {
  const nodes = graph.nodes.map((node, index) => {
    if (node.kind === 'solar') {
      return {
        ...node,
        orbiters: node.orbiters?.length ? node.orbiters : createOrbiters({ key: node.key }),
        fieldDensity: 1.15,
      };
    }

    if (node.kind === 'blackhole') {
      return {
        ...node,
        horizonRadius: round((node.radius || 1.8) * 1.42),
        lensing: round(0.85 + (node.curvature || 0.3) * 0.7),
        debrisBelt: {
          count: 12 + (index % 5) * 6,
          spread: round((node.radius || 1.8) * 5.8),
          speed: round(0.09 + (index % 4) * 0.03),
        },
      };
    }

    if (node.generated) {
      return {
        ...node,
        pulseRate: round(0.8 + (index % 4) * 0.16),
      };
    }

    return node;
  });

  return {
    ...graph,
    nodes,
    simulationTier: 'maximum-realism',
  };
}
