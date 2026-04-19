import Link from 'next/link';

const quickLinks = [
  { href: '/', label: 'Return to Hub' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/donate', label: 'Donate' },
  { href: '/report-player', label: 'Report' },
  { href: '/privacy-policy', label: 'Privacy' },
  { href: '/terms-and-conditions', label: 'Terms' },
];

export default function PageShell({ eyebrow, title, text, children }) {
  return (
    <main className="content-page">
      <div className="content-backdrop" />
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
      </section>

      <section className="page-section">{children}</section>
    </main>
  );
}
