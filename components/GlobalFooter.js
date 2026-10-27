import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';

const footerLinks = [
  { href: '/our-flight-plan', label: 'Our Flight plan' },
  { href: '/legal', label: 'Legal documents' },
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/terms-and-conditions', label: 'Terms & Conditions' },
  { href: '/eula', label: 'EULA' },
  { href: '/multiplayer-policy', label: 'Multiplayer Policy' },
  { href: '/support-policy', label: 'Support & payments' },
  { href: '/contact', label: 'Contact' },
  { href: '/hub-form', label: 'Community board' },
  { href: '/information', label: 'Player guide' },
  { href: '/server-info', label: 'Servers' },
];

export default function GlobalFooter() {
  return (
    <footer className="global-footer">
      <div className="global-footer__inner">
        <div>
          <Link href="/" aria-label="T-Central Hub home" className="global-footer__brand"><BrandLogo /></Link>
          <p className="global-footer__text">
            An independent browser universe and a place for curious players to explore, connect and create.
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
          <p className="global-footer__text">Central Synaptic Intelligence Systems · British Columbia, Canada</p>
          <p className="global-footer__text">BrainandBodyai@gmail.com</p>
          <p className="global-footer__caption">E_s Credits are gameplay units with no T-Central cash-redemption right.</p>
        </div>
      </div>
    </footer>
  );
}
