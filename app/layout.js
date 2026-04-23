import './globals.css';
import { SteamSessionProvider } from '@/components/SteamSessionProvider';
import ConsentGate from '@/components/ConsentGate';
import GlobalFooter from '@/components/GlobalFooter';
import { getSiteUrl } from '@/lib/runtimeConfig';
import { Analytics } from '@vercel/analytics/next';

const siteUrl = getSiteUrl();

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: 'T-Central Hub',
  description: 'Interactive game server and web-game hub for T-Central.',
  alternates: {
    canonical: '/',
  },
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
          {children}
          <GlobalFooter />
        </SteamSessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
