import { buildUniverseGraph } from '@/lib/universeEngine';

const DEFAULT_DYSON_MAP_ANCHOR = Object.freeze({
  id: 'ss',
  label: 'S.S',
  anchorLabel: 'S.S',
  color: '#ffd15c',
  position: [5.15, 2.5, -0.45],
  href: 'https://synapticsystems.ca',
  sublabel: 'External site',
  anchorSublabel: 'Dyson sphere link',
  description: 'Opens SynapticSystems.ca.',
  external: true,
});

const PUBLIC_ANCHOR_FIELDS = [
  'id',
  'label',
  'anchorLabel',
  'color',
  'position',
  'href',
  'sublabel',
  'anchorSublabel',
  'description',
  'external',
];

function cleanFiniteNumber(value, fallbackValue = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : fallbackValue;
}

function cleanPosition(position, fallbackPosition = DEFAULT_DYSON_MAP_ANCHOR.position) {
  if (!Array.isArray(position) || position.length < 3) return [...fallbackPosition];
  return [0, 1, 2].map((index) => cleanFiniteNumber(position[index], fallbackPosition[index]));
}

function cleanString(value, fallbackValue) {
  if (typeof value !== 'string') return fallbackValue;
  const trimmed = value.trim();
  return trimmed || fallbackValue;
}

function cleanColor(value, fallbackValue = DEFAULT_DYSON_MAP_ANCHOR.color) {
  if (typeof value !== 'string') return fallbackValue;
  const trimmed = value.trim();
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(trimmed) ? trimmed : fallbackValue;
}

function cleanHref(value, fallbackValue = DEFAULT_DYSON_MAP_ANCHOR.href) {
  if (typeof value !== 'string') return fallbackValue;
  const trimmed = value.trim();
  if (trimmed.startsWith('/')) return trimmed;

  try {
    const parsed = new URL(trimmed);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function toPublicDysonMapAnchor(anchor = {}, fallback = DEFAULT_DYSON_MAP_ANCHOR) {
  const publicAnchor = {
    id: cleanString(anchor.key || anchor.id, fallback.id),
    label: cleanString(anchor.mapLabel || anchor.shortLabel || anchor.label, fallback.label),
    anchorLabel: cleanString(anchor.anchorLabel || anchor.mapLabel || anchor.shortLabel || anchor.label, fallback.anchorLabel),
    color: cleanColor(anchor.color, fallback.color),
    position: cleanPosition(anchor.position, fallback.position),
    href: cleanHref(anchor.route || anchor.href, fallback.href),
    sublabel: cleanString(anchor.sublabel || anchor.address, fallback.sublabel),
    anchorSublabel: cleanString(anchor.anchorSublabel || anchor.mapSublabel, fallback.anchorSublabel),
    description: cleanString(anchor.publicDescription || anchor.description, fallback.description),
    external: Boolean(anchor.external ?? fallback.external),
  };

  return Object.fromEntries(PUBLIC_ANCHOR_FIELDS.map((field) => [field, publicAnchor[field]]));
}

function resolveGraphDysonAnchor() {
  const graph = buildUniverseGraph();
  return graph.nodes.find((node) => node.key === 'ss')
    || graph.nodes.find((node) => node.kind === 'dyson' && node.dysonProfile === 'synaptics')
    || null;
}

export function getDefaultDysonMapAnchor() {
  return { ...DEFAULT_DYSON_MAP_ANCHOR, position: [...DEFAULT_DYSON_MAP_ANCHOR.position] };
}

export function getPublicDysonMapAnchors() {
  try {
    const graphAnchor = resolveGraphDysonAnchor();
    if (!graphAnchor) {
      return {
        source: 'fallback',
        anchors: [getDefaultDysonMapAnchor()],
      };
    }

    return {
      source: 'universe-graph',
      anchors: [toPublicDysonMapAnchor({
        ...graphAnchor,
        mapLabel: DEFAULT_DYSON_MAP_ANCHOR.label,
        anchorLabel: DEFAULT_DYSON_MAP_ANCHOR.anchorLabel,
        anchorSublabel: DEFAULT_DYSON_MAP_ANCHOR.anchorSublabel,
        route: graphAnchor.route || DEFAULT_DYSON_MAP_ANCHOR.href,
        sublabel: DEFAULT_DYSON_MAP_ANCHOR.sublabel,
        publicDescription: DEFAULT_DYSON_MAP_ANCHOR.description,
        external: graphAnchor.external ?? DEFAULT_DYSON_MAP_ANCHOR.external,
      })],
    };
  } catch {
    return {
      source: 'fallback',
      anchors: [getDefaultDysonMapAnchor()],
    };
  }
}
