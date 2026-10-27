'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import BrandLogo from '@/components/BrandLogo';

const links = [
  ['/', 'Home'],
  ['/system', 'Play'],
  ['/server-info', 'Servers'],
  ['/hub-form', 'Community'],
  ['/information', 'Guide'],
  ['/status', 'Status'],
  ['/our-flight-plan', 'Our Flight plan'],
  ['/about', 'About'],
  ['/contact', 'Contact'],
];

export default function SiteNavigation() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event) => { if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);
  // The simulation has its own controls and home link.
  if (pathname === '/system' || pathname.startsWith('/system/')) return null;

  return (
    <header className="site-header">
      <Link href="/" className="site-brand" aria-label="T-Central Hub home"><BrandLogo /></Link>
      <button ref={menuButton} type="button" className="site-menu-toggle" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close' : 'Menu'} <span aria-hidden="true">{menuOpen ? '×' : '☰'}</span></button>
      <nav id="main-navigation" className={`site-navigation${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation" onClick={() => setMenuOpen(false)}>
        {links.map(([href, label]) => {
          const active = pathname === href || (href === '/server-info' && pathname.startsWith('/servers/'));
          return <Link key={href} href={href} aria-current={active ? 'page' : undefined}>{label}</Link>;
        })}
      </nav>
      <Link href="/donate" className="site-support" aria-current={pathname === '/donate' ? 'page' : undefined}>Support</Link>
    </header>
  );
}
