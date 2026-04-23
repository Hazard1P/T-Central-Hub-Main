const SPIN_DIMENSIONS = ['spin_half_plus', 'spin_half_minus', 'spin_quarter_plus', 'spin_quarter_minus'];

export const HYPERSPACE_DIMENSIONS = [
  ...SPIN_DIMENSIONS,
  'phase',
  'coherence',
  'entanglement',
  'curvature',
  'inertia',
  'graviton',
  'horizon',
  'flux',
  'topology',
  'lensing',
  'navigation',
];

export const HYPERSPACE_DIMENSION_LABELS = HYPERSPACE_DIMENSIONS.reduce((labels, key, index) => {
  labels[key] = `D${index + 1}`;
  return labels;
}, {});

export const HYPERSPACE_DIMENSION_COUNT = HYPERSPACE_DIMENSIONS.length;
export const HYPERSPACE_SIGNATURE_PREFIX = `Q${HYPERSPACE_DIMENSION_COUNT}D`;

export function formatHyperspaceSignature(suffix = 'Observer') {
  return `${HYPERSPACE_SIGNATURE_PREFIX}-${suffix || 'Observer'}`;
}

export const DEFAULT_HYPERSPACE_SIGNATURE = formatHyperspaceSignature('Observer');
export const DEFAULT_PRESENCE_SIGNATURE = formatHyperspaceSignature('0-0');

export function normalizeHyperspaceSignature(value, fallback = DEFAULT_PRESENCE_SIGNATURE) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const prefixedMatch = trimmed.match(/^Q\d+D-(.+)$/i);
  if (prefixedMatch?.[1]) {
    return formatHyperspaceSignature(prefixedMatch[1]);
  }

  if (trimmed.startsWith(`${HYPERSPACE_SIGNATURE_PREFIX}-`)) return trimmed;

  if (/^(observer|0-0)$/i.test(trimmed)) {
    return formatHyperspaceSignature(trimmed);
  }

  return trimmed.includes('-') ? formatHyperspaceSignature(trimmed) : fallback;
}

export function describeHyperspaceDimensions() {
  return `${HYPERSPACE_DIMENSION_COUNT}-dimensional`;
}
