const BASE_SERVER_DEFINITIONS = [
  {
    id: 'arma3-cth-primary',
    slug: 'arma3-cth',
    statusKey: 'arma3',
    title: 'T-Central Arma3 CTH',
    shortTitle: 'Arma3 CTH',
    href: '/servers/arma3-cth',
    ip: 'tcentral.game.nfoservers.com:2302',
    game: 'Arma 3',
    mode: 'CTH',
    map: 'Altis',
    tier: 'Primary',
    maxPlayers: 60,
    steamAppId: '107410',
    launchLabel: 'Launch Arma 3',
    connectLabel: 'Quick Connect',
    source: 'No status source configured',
    reportLabel: 'Arma3 CTH',
    summary: 'Battlefield-focused page with direct connect details, tactical presentation, and room for future events.',
    detailTitle: 'Public tactical hill-control combat.',
    detailText: 'Use this page for the live Arma 3 server address, team-entry routing, and future event rotation notes.',
    tags: ['arma3', 'cth', 'altis', 'primary'],
    accent: 'Tactical route',
    family: 'arma',
  },
  {
    id: 'rust-biweekly-primary',
    slug: 'rust-biweekly',
    statusKey: 'rust_biweekly',
    title: 'T-Central Rust Bi-Weekly',
    shortTitle: 'Rust Bi-Weekly',
    href: '/servers/rust-biweekly',
    ip: 'tcentralrust.game.nfoservers.com:28015',
    game: 'Rust',
    mode: 'Vanilla',
    map: 'Procedural Map',
    tier: 'Primary',
    maxPlayers: 250,
    wipeCadence: 'Bi-Weekly Wipe',
    steamAppId: '252490',
    launchLabel: 'Launch Rust',
    connectLabel: 'Quick Connect',
    source: 'No status source configured',
    reportLabel: 'Rust Bi-Weekly',
    summary: 'Bi-weekly Rust server with a procedural map and room for future wipe and community updates.',
    detailTitle: 'Bi-weekly Rust cycle with a direct route in.',
    detailText: 'Use this page for the bi-weekly server address, map notes, and future wipe updates.',
    tags: ['rust', 'vanilla', 'biweekly', 'primary'],
    accent: 'Primary Rust route',
    family: 'rust',
  },
  {
    id: 'rust-weekly-primary',
    slug: 'rust-weekly',
    statusKey: 'rust_weekly',
    title: 'T-Central Rust Weekly',
    shortTitle: 'Rust Weekly',
    href: '/servers/rust-weekly',
    ip: 'tcentralrust2.game.nfoservers.com:28015',
    game: 'Rust',
    mode: 'Vanilla',
    map: 'Procedural Map',
    tier: 'Primary',
    maxPlayers: 250,
    wipeCadence: 'Weekly Wipe',
    steamAppId: '252490',
    launchLabel: 'Launch Rust',
    connectLabel: 'Quick Connect',
    source: 'No status source configured',
    reportLabel: 'Rust Weekly',
    summary: 'Weekly Rust server for players who want faster reset cycles, fresh starts, and a quick route into a new procedural map.',
    detailTitle: 'Weekly Rust cycle with fast resets.',
    detailText: 'Use this page for the weekly server address, reset cadence, and any future featured events.',
    tags: ['rust', 'vanilla', 'weekly', 'primary'],
    accent: 'Fast-cycle route',
    family: 'rust',
  },
  {
    id: 'rust-monthly-primary',
    slug: 'rust-monthly',
    statusKey: 'rust_monthly',
    title: 'T-Central Rust Monthly',
    shortTitle: 'Rust Monthly',
    href: '/servers/rust-monthly',
    ip: 'tcentralrust3.game.nfoservers.com:28015',
    game: 'Rust',
    mode: 'Vanilla',
    map: 'Procedural Map',
    tier: 'Primary',
    maxPlayers: 250,
    wipeCadence: 'Monthly Wipe',
    steamAppId: '252490',
    launchLabel: 'Launch Rust',
    connectLabel: 'Quick Connect',
    source: 'No status source configured',
    reportLabel: 'Rust Monthly',
    summary: 'Monthly Rust server built for longer progression, a steadier rhythm, and a simpler way for players to find the right wipe cadence.',
    detailTitle: 'Monthly Rust progression route.',
    detailText: 'Use this page for the long-cycle Rust server address, map state, and progression-oriented notes.',
    tags: ['rust', 'vanilla', 'monthly', 'primary'],
    accent: 'Long-cycle route',
    family: 'rust',
  },
  {
    id: 'rust-vanilla-overview',
    slug: 'rust-vanilla',
    statusKey: 'rust_biweekly',
    title: 'T-Central Rust Vanilla',
    shortTitle: 'Rust Vanilla',
    href: '/servers/rust-vanilla',
    ip: 'tcentralrust.game.nfoservers.com:28015',
    game: 'Rust',
    mode: 'Vanilla',
    map: 'Procedural Map',
    tier: 'Overview',
    maxPlayers: 250,
    wipeCadence: 'Bi-Weekly Wipe',
    steamAppId: '252490',
    launchLabel: 'Launch Rust',
    connectLabel: 'Quick Connect',
    source: 'No status source configured',
    reportLabel: 'Rust Vanilla',
    summary: 'Overview route for the Rust server family, linking the shared vanilla shell to the active wipe cadence.',
    detailTitle: 'Shared Rust vanilla route.',
    detailText: 'Use this page as the overview layer for Rust access, wipe cadence selection, and future expansions.',
    tags: ['rust', 'vanilla', 'overview'],
    accent: 'Overview shell',
    family: 'rust',
  },
];

function enrichServerDefinition(server, index) {
  const totalPlayers = server.maxPlayers ? `${server.maxPlayers} Players` : 'Capacity evolving';
  const cadenceLabel = server.wipeCadence ?? server.mode ?? 'Live route';

  return {
    ...server,
    order: index,
    summary: server.summary ?? `${server.game} route with a dynamic entry surface and shared status integration.`,
    detailTitle: server.detailTitle ?? `${server.shortTitle} direct route`,
    detailText: server.detailText ?? 'Use this page for address details, map notes, and live route expansion.',
    detailStats: [
      { label: 'Address', value: server.ip },
      { label: server.game === 'Rust' ? 'Wipe cadence' : 'Mode', value: cadenceLabel },
      { label: 'Capacity', value: totalPlayers },
    ],
  };
}

export const SERVER_DEFINITIONS = BASE_SERVER_DEFINITIONS.map(enrichServerDefinition);
export const PRIMARY_SERVER_ROUTES = SERVER_DEFINITIONS.filter((server) => server.tier !== 'Overview');

export const STATUS_DEFAULTS = Object.fromEntries(
  PRIMARY_SERVER_ROUTES.map((server) => [
    server.statusKey,
    {
      key: server.statusKey,
      name: server.shortTitle,
      online: null,
      players: 0,
      maxPlayers: server.maxPlayers ?? null,
      map: server.map ?? null,
      source: server.source,
      route: server.href,
      ip: server.ip,
    },
  ])
);

export const REPORT_SERVER_OPTIONS = ['T-Central Hub', ...PRIMARY_SERVER_ROUTES.map((server) => server.reportLabel)];

export const SITE_ROUTES = [
  '',
  '/system',
  '/information',
  '/server-info',
  '/status',
  '/donate',
  '/privacy-policy',
  '/terms-and-conditions',
  '/report-player',
  '/about',
  '/contact',
  ...SERVER_DEFINITIONS.map((server) => server.href),
];

export function getServerBySlug(slug) {
  return SERVER_DEFINITIONS.find((server) => server.slug === slug) ?? null;
}

export function getPrimaryRouteServers(limit = PRIMARY_SERVER_ROUTES.length) {
  return PRIMARY_SERVER_ROUTES.slice(0, limit);
}

export function getRelatedServers(server, limit = 3) {
  if (!server) return [];
  return PRIMARY_SERVER_ROUTES
    .filter((candidate) => candidate.slug !== server.slug && candidate.family === server.family)
    .slice(0, limit);
}

export function mergeStatusesWithDefaults(statuses = {}) {
  return Object.fromEntries(
    Object.entries(STATUS_DEFAULTS).map(([key, fallback]) => {
      const incoming = statuses?.[key] ?? {};
      return [
        key,
        {
          ...fallback,
          ...incoming,
          key,
          name: incoming.name ?? fallback.name,
          maxPlayers: incoming.maxPlayers ?? fallback.maxPlayers,
          map: incoming.map ?? fallback.map,
          source: incoming.source ?? fallback.source,
          route: incoming.route ?? fallback.route,
          ip: incoming.ip ?? fallback.ip,
        },
      ];
    })
  );
}
