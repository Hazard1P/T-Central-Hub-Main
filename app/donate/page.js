import PageShell from '@/components/PageShell';
import DonateSupportClient from '@/components/DonateSupportClient';
import Link from 'next/link';

export const metadata = { title: 'Support the hub' };

const legalDisclosureLinks = [
  { href: '/support-policy', label: 'Support & payments' },
  { href: '/terms-and-conditions', label: 'Terms' },
  { href: '/privacy-policy', label: 'Privacy' },
  { href: '/eula', label: 'EULA' },
  { href: '/multiplayer-policy', label: 'Multiplayer Policy' },
  { href: '/contact', label: 'Contact' }
];

function PaymentLegalDisclosure() {
  return (
    <aside className="donate-legal-disclosure" aria-label="Payment legal disclosure">
      <strong>Payment disclosure</strong>
      <p>
        One-time donations and recurring support are voluntary and processed by PayPal. Monthly support recurs until
        cancelled through PayPal or the available account-management path, and support does not provide in-game
        currency, stored value, external payout rights, real-world return, paid gameplay advantage, or ownership in T-Central. PayPal.Me fallback may not automatically
        bind to a Steam-linked account. See the linked legal pages for details or use <Link href="/contact">contact</Link> for help.
      </p>
      <nav className="donate-legal-links" aria-label="Donation legal links">
        {legalDisclosureLinks.map((link) => (
          <Link key={link.href} href={link.href}>{link.label}</Link>
        ))}
      </nav>
    </aside>
  );
}

export default function DonatePage() {
  return (
    <PageShell eyebrow="Support T-Central" title="Help keep the hub moving." text="Support hosting, community events, and future development. Choose a Steam-linked checkout when available, or send a one-time gift through PayPal.Me.">
      <div className="support-options">
        <section className="content-card" id="protected-paypal-flow" aria-labelledby="protected-checkout-title">
          <p className="eyebrow">Account-linked support</p>
          <h2 id="protected-checkout-title">Donate or subscribe</h2>
          <p className="muted">Sign in with Steam to link your support to your account. Available checkout options and subscription management appear below.</p>
          <DonateSupportClient />
        </section>
        <section className="content-card" aria-labelledby="direct-support-title">
          <p className="eyebrow">One-time support</p>
          <h2 id="direct-support-title">Choose your own amount</h2>
          <p className="muted">Use PayPal.Me for a direct gift. This contribution may not automatically appear on your Steam-linked account.</p>
          <a className="button secondary" href="https://paypal.me/TCentralG" target="_blank" rel="noreferrer">Continue to PayPal.Me</a>
          <p className="muted">Need help with a contribution? <Link href="/contact">Contact the team</Link>.</p>
        </section>
      </div>
      <PaymentLegalDisclosure />
    </PageShell>
  );
}
