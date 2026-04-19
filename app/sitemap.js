import { SITE_ROUTES } from '@/lib/serverData';

const routes = [...new Set(SITE_ROUTES)];

export default function sitemap() {
  return routes.map((route) => ({
    url: `https://t-central.me${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' || route === '/system' ? 'daily' : 'weekly',
    priority: route === '' ? 1 : route === '/system' ? 0.9 : 0.8,
  }));
}
