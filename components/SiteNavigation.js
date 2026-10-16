'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  ['/', 'Home'],
  ['/system', 'Play'],
  ['/server-info', 'Servers'],
  ['/hub-form', 'Community'],
  ['/information', 'Guide'],
  ['/status', 'Status'],
  ['/about', 'About'],
  ['/contact', 'Contact'],
];

export default function SiteNavigation() {
  const pathname = usePathname();
  // The simulation has its own controls and home link.
  if (pathname === '/system') return null;

  return (
    <header className="site-header">
      <Link href="/" className="site-brand" aria-label="T-Central Hub home">T-Central <span>Hub</span></Link>
      <nav className="site-navigation" aria-label="Main navigation">
        {links.map(([href, label]) => {
          const active = pathname === href || (href === '/server-info' && pathname.startsWith('/servers/'));
          return <Link key={href} href={href} aria-current={active ? 'page' : undefined}>{label}</Link>;
        })}
      </nav>
      <Link href="/donate" className="site-support" aria-current={pathname === '/donate' ? 'page' : undefined}>Support</Link>
    </header>
  );
}
