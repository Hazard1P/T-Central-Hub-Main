import Link from 'next/link';

const quickLinks = [
  { href: '/', label: 'Return to Hub' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/hub-form', label: 'Hub Form' },
  { href: '/donate', label: 'Donate' },
  { href: '/report-player', label: 'Report' },
  { href: '/privacy-policy', label: 'Privacy' },
  { href: '/terms-and-conditions', label: 'Terms' },
];

export default function PageShell({ eyebrow, title, text, heroImage = null, children }) {
  return (
    <main className="content-page">
      <div className="content-backdrop" />
      <div className="content-noise" />
      <div className="content-bubbles">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href} className="bubble-link">
            {link.label}
          </Link>
        ))}
      </div>

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
