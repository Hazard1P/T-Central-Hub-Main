import { getPrimaryRouteServers } from '@/lib/serverData';
import { ROUTE_CHIPS, WORLD_SUMMARY } from '@/lib/worldLayout';

export function getHomeLaunchCards() {
  return getPrimaryRouteServers(4).map((server, index) => ({
    kicker: server.accent ?? server.game,
    title: server.shortTitle,
    copy: server.summary,
    href: server.href,
    priority: index,
  }));
}

export function getHomeStatusPills() {
  return [
    'Deep-space anchor online',
    'Steam layer ready',
    `${getPrimaryRouteServers().length} route wells synchronized`,
    `${WORLD_SUMMARY.nodes} expansion nodes generated`,
  ];
}

export function getSystemStatusPills() {
  return [
    { label: 'Layer', value: 'Live 3D Web-Game' },
    { label: 'Roles', value: 'Pilot / Spectate' },
    { label: 'Primary routes', value: `${getPrimaryRouteServers().length} active` },
    { label: 'Expansion nodes', value: `${WORLD_SUMMARY.nodes}` },
  ];
}

export function getSystemNewsItems() {
  const defaultItems = [
    { label: 'Information', href: '/information', note: 'Updates, onboarding, and guidance.' },
    { label: 'Server Info', href: '/server-info', note: 'Route details and live server notes.' },
    { label: 'Status', href: '/status', note: 'Availability and shell status.' },
    { label: 'About', href: '/about', note: 'Vision, architecture, and founder overview.' },
    { label: 'Contact', href: '/contact', note: 'Direct support and partnership channel.' },
    { label: 'Report Player', href: '/report-player', note: 'Moderation and support path.' },
  ];

  const routeItems = getPrimaryRouteServers(3).map((server) => ({
    label: server.shortTitle,
    href: server.href,
    note: server.summary,
  }));

  return [...defaultItems, ...routeItems];
}

export function getFeaturedRouteLabels() {
  return ROUTE_CHIPS;
}
