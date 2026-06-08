import PageShell from '@/components/PageShell';

export const metadata = { title: 'Terms and Conditions' };

const termsSections = [
  {
    id: 'use-of-service',
    eyebrow: 'Use of service',
    title: 'Use of service',
    text: 'Users are expected to use the site, shared hub, private worlds, and connected route portals responsibly and in accordance with applicable community rules.',
  },
  {
    id: 'community-conduct',
    eyebrow: 'Community conduct',
    title: 'Community conduct',
    text: 'Do not harass, exploit, impersonate, disrupt services, evade moderation, or interfere with another player\'s ability to participate safely in T-Central spaces.',
  },
  {
    id: 'public-private-spaces',
    eyebrow: 'Lobby modes',
    title: 'Public/private spaces',
    text: 'The multiplayer hub is intended as a shared Steam-linked room. Private worlds are intended to remain user-scoped while still allowing server and route access.',
  },
  {
    id: 'external-services',
    eyebrow: 'External services',
    title: 'External services',
    text: 'Route portals, Steam authentication, payment providers, game servers, and community platforms may have separate rules, account requirements, uptime behavior, and privacy practices.',
  },
  {
    id: 'availability-and-changes',
    eyebrow: 'Availability',
    title: 'Availability and changes',
    text: 'Features, servers, private spaces, route links, and policies may change, pause, or become unavailable as systems are maintained, secured, moderated, or updated.',
  },
];

export default function TermsPage() {
  return (
    <PageShell
      eyebrow="Terms and conditions"
      title="Terms and conditions"
      text="These terms cover use of the T-Central website, the multiplayer hub, private player worlds, linked identity features, and route portals into game servers and external systems."
    >
      <section className="content-card" aria-labelledby="terms-legal-overview">
        <p className="eyebrow">Legal notice</p>
        <h3 id="terms-legal-overview">Terms for T-Central services</h3>
        <p className="muted">
          These terms set expectations for using T-Central web pages, shared community spaces, private player worlds, Steam-linked features, and routes into external systems.
        </p>
        <div className="arma-brief-grid" aria-label="Terms metadata">
          <div className="arma-highlight">
            <strong>Last updated</strong>
            <span className="muted">June 8, 2026</span>
          </div>
          <div className="arma-highlight">
            <strong>Applies to</strong>
            <span className="muted">Website, multiplayer hub, private worlds, linked identity, and route portals</span>
          </div>
          <div className="arma-highlight">
            <strong>Support channel</strong>
            <span className="muted">General support, conduct reports, access issues, and route questions</span>
          </div>
        </div>
      </section>

      <nav className="content-card" aria-label="Terms summary">
        <p className="eyebrow">Summary</p>
        <h3>On this page</h3>
        <ul className="arma-list">
          {termsSections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.title}</a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="arma-brief-grid">
        {termsSections.map((section) => (
          <article className="content-card" id={section.id} key={section.id}>
            <p className="eyebrow">{section.eyebrow}</p>
            <h3>{section.title}</h3>
            <p className="muted">{section.text}</p>
          </article>
        ))}
      </div>

      <section className="content-card" aria-labelledby="terms-support-cta">
        <p className="eyebrow">Need help?</p>
        <h3 id="terms-support-cta">Contact support or report conduct issues</h3>
        <p className="muted">
          Contact the T-Central team for account, route, or service questions. Use the report form for harassment, cheating, griefing, or other community conduct concerns.
        </p>
        <div className="donate-legal-links" aria-label="Terms support links">
          <a href="/contact">Contact support</a>
          <a href="/report-player">Report a player</a>
        </div>
      </section>
    </PageShell>
  );
}
