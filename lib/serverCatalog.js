import { PRIMARY_SERVER_ROUTES } from '@/lib/serverData';

export const SERVER_CATALOG = PRIMARY_SERVER_ROUTES.reduce((catalog, server) => {
  const groupKey = server.game.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const current = catalog[groupKey] || [];
  current.push({
    id: server.id,
    title: server.title,
    ip: server.ip,
    game: server.game,
    mode: server.mode,
    map: server.map,
    tier: server.tier,
    steamAppId: server.steamAppId,
    statusKey: server.statusKey,
    tags: server.tags,
  });
  catalog[groupKey] = current;
  return catalog;
}, {});
