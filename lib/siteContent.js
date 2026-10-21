import { getPrimaryRouteServers } from '@/lib/serverData';
import { ROUTE_CHIPS, WORLD_SUMMARY } from '@/lib/worldLayout';

export const FLIGHT_CONTROL_COPY = {
  desktopSummary: 'WASD / arrows',
  verticalSummary: 'Space / Shift',
  boostSummary: 'Control',
  touchSummary: 'flight pad',
  launchPrimer:
    'Desktop: WASD / arrows to fly nose-forward, Space / Shift to climb and dive, hold Control to boost. Move the mouse to steer; click or hold V to fire. Esc releases the cursor. Mobile: drag space to steer, use the flight pad and hold Fire.',
  fullSummary:
    'Controls: WASD / arrows to fly nose-forward, Space / Shift to climb and dive, hold Control to boost, X to brake, M for destinations, and H to hide the HUD. Move the mouse to steer, click or V to fire, and Esc to release the cursor.',
};

export function getHomeLaunchCards() {
  return [
    { kicker: 'Independent communities', title: 'Rust servers', copy: 'Discover populated Rust servers, compare maps and choose your next session.', href: '/server-info?game=rust' },
    { kicker: 'Tactical play', title: 'Arma 3 servers', copy: 'Browse ranked Arma 3 communities and review connection options.', href: '/server-info?game=arma3' },
    { kicker: 'Build it together', title: 'Community conversations', copy: 'Share ideas, events and feedback with your Steam or Google account.', href: '/hub-form' },
  ];
}

export function getHomeStatusPills() {
  return [
    'Explore the universe',
    'Guest play available',
    'Rust + Arma 3 discovery',
    `${WORLD_SUMMARY.nodes} universe nodes`,
  ];
}

export function getSystemStatusPills() {
  return [
    { label: 'Layer', value: 'Live 3D Web-Game' },
    { label: 'Roles', value: 'Pilot / Spectate' },
    { label: 'Primary routes', value: 'Third-party discovery' },
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
