import './globals.css';
import { SteamSessionProvider } from '@/components/SteamSessionProvider';
import ConsentGate from '@/components/ConsentGate';
import SiteNavigation from '@/components/SiteNavigation';
import GlobalFooter from '@/components/GlobalFooter';
import { getSiteUrl } from '@/lib/runtimeConfig';
import { Analytics } from '@vercel/analytics/next';

const siteUrl = getSiteUrl();

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'T-Central Hub', template: '%s | T-Central Hub' },
  description: 'Interactive game server and web-game hub for T-Central.',
  openGraph: {
    title: 'T-Central Hub',
    description: 'Interactive game server and web-game hub for T-Central.',
    url: siteUrl,
    siteName: 'T-Central Hub',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SteamSessionProvider>
          <ConsentGate />
          <div id="site-content">
            <a className="skip-link" href="#main-content">Skip to content</a>
            <SiteNavigation />
            <div id="main-content" tabIndex={-1}>{children}</div>
            <GlobalFooter />
          </div>
        </SteamSessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
