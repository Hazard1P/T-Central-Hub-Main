// Legacy route identifiers remain stable for universe bookmarks. They now open
// third-party discovery; none represents an active T-Central-operated server.
const BASE_SERVER_DEFINITIONS = [
  { id: 'arma3-cth-primary', slug: 'arma3-cth', statusKey: 'arma3', title: 'Arma 3 community servers', shortTitle: 'Arma 3 servers', game: 'Arma 3', family: 'arma', steamAppId: '107410', mode: 'Community discovery', summary: 'Discover ranked, populated Arma 3 servers run by independent communities.', accent: 'Tactical communities' },
  { id: 'rust-biweekly-primary', slug: 'rust-biweekly', statusKey: 'rust_biweekly', title: 'Rust community servers', shortTitle: 'Rust servers', game: 'Rust', family: 'rust', steamAppId: '252490', mode: 'Community discovery', summary: 'Find populated Rust servers and compare their current player counts and maps.', accent: 'Survival communities' },
  { id: 'rust-weekly-primary', slug: 'rust-weekly', statusKey: 'rust_weekly', title: 'Rust server discovery', shortTitle: 'Rust discovery', game: 'Rust', family: 'rust', steamAppId: '252490', mode: 'Community discovery', summary: 'Explore independent Rust servers. Check each operator’s wipe schedule before joining.', accent: 'Find your next session' },
  { id: 'rust-monthly-primary', slug: 'rust-monthly', statusKey: 'rust_monthly', title: 'Rust community browser', shortTitle: 'Rust communities', game: 'Rust', family: 'rust', steamAppId: '252490', mode: 'Community discovery', summary: 'Browse third-party Rust communities; listings do not imply T-Central ownership.', accent: 'Community discovery' },
  { id: 'rust-vanilla-overview', slug: 'rust-vanilla', statusKey: 'rust_biweekly', title: 'Rust server overview', shortTitle: 'Rust overview', game: 'Rust', family: 'rust', steamAppId: '252490', tier: 'Overview', mode: 'Community discovery', summary: 'Compare current Rust servers and review their rules and mods before joining.' },
].map((server) => ({ ...server, href: `/servers/${server.slug}`, ip: null, maxPlayers: null, map: null, tier: server.tier || 'Directory', source: 'Third-party directory; no hosted T-Central server', owned: false, active: false, detailTitle: server.title, detailText: server.summary }));

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
    integration: server.integration || null,
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

export const REPORT_SERVER_OPTIONS = ['T-Central Hub', 'Community board', 'Browser universe', 'Rust (third-party)', 'Arma 3 (third-party)'];

export const SITE_ROUTES = [
  '/legal',
  '/support-policy',
  '',
  '/system',
  '/information',
  '/server-info',
  '/status',
  '/donate',
  '/privacy-policy',
  '/terms-and-conditions',
  '/report-player',
  '/hub-form',
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
