'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const quickLinks = [
  { href: '/hub-form', label: 'Community board' },
  { href: '/donate', label: 'Support the hub' },
  { href: '/report-player', label: 'Report a player' },
];

const normalizeHref = (href) => {
  if (!href || href === '/') {
    return '/';
  }

  return href.endsWith('/') ? href.slice(0, -1) : href;
};

export default function PageShell({ eyebrow, title, text, heroImage = null, activeHref, children }) {
  const pathname = usePathname();
  const currentHref = normalizeHref(activeHref || pathname);

  return (
    <main className="content-page">
      <div className="content-backdrop" />
      <div className="content-noise" />
      <nav className="content-bubbles" aria-label="Community and support">
        {quickLinks.map((link) => {
          const isActive = normalizeHref(link.href) === currentHref;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`bubble-link${isActive ? ' is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <section className="page-hero">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{text}</p>
        {heroImage?.src ? (
          <div className="page-hero-media">
            <img src={heroImage.src} alt={heroImage.alt || title} />
          </div>
        ) : null}
      </section>

      <section className="page-section">{children}</section>
    </main>
  );
}
