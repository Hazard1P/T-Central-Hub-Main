import Link from 'next/link';

const footerLinks = [
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/terms-and-conditions', label: 'Terms & Conditions' },
  { href: '/eula', label: 'EULA' },
  { href: '/multiplayer-policy', label: 'Multiplayer Policy' },
  { href: '/contact', label: 'Contact' },
  { href: '/hub-form', label: 'Hub Form' },
];

export default function GlobalFooter() {
  return (
    <footer className="global-footer">
      <div className="global-footer__inner">
        <div>
          <p className="global-footer__title">T-Central Hub</p>
          <p className="global-footer__text">
            T-Central is a game universe with private and shared spaces, route portals, and an in-game entropic settlement loop.
          </p>
        </div>
        <nav className="global-footer__links" aria-label="Legal and contact">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className="global-footer__link">
              {link.label}
            </Link>
          ))}
        </nav>
        <div>
          <p className="global-footer__text">Michael Rybaltowicz</p>
          <p className="global-footer__text">BrainandBodyai@gmail.com</p>
          <p className="global-footer__caption">E_s Credits are in-game units with no guaranteed real-world monetary value.</p>
        </div>
      </div>
    </footer>
  );
}
