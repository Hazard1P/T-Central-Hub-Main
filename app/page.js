import SteamLoginHud from '@/components/SteamLoginHud';
import CinematicUniverseCanvas from '@/components/CinematicUniverseCanvas';
import { getHomeLaunchCards, getHomeStatusPills } from '@/lib/siteContent';
import { buildUniverseGraph } from '@/lib/universeEngine';
import { PRIMARY_SERVER_ROUTES } from '@/lib/serverData';

export default function HomePage() {
  const launchCards = getHomeLaunchCards().slice(0, 3);
  const statusPills = getHomeStatusPills();
  const graph = buildUniverseGraph();
  const featuredRoutes = PRIMARY_SERVER_ROUTES.slice(0, 3);

  return (
    <main className="entry-page cosmic-entry-page simplified-home-page">
      <CinematicUniverseCanvas mode="landing" className="entry-universe-canvas" />
      <SteamLoginHud />
      <div className="cosmic-overlay cinematic" />

      <section className="entry-shell simplified">
        <div className="entry-copy cosmic-hero-panel entry-hero-panel simplified-panel">
          <p className="eyebrow">T-Central Hub</p>
          <h1>Main gateway for cinematic routing, Steam handoff, and live server entry.</h1>
          <p className="muted max-copy">
            The front page now acts as mission control for your web layer and in-game 3D/15D blackhole system: discover routes, read mode briefs, and jump
            straight into game servers with quick Steam connect actions.
          </p>

          <div className="entry-actions">
            <a className="button primary" href="/system">Enter system</a>
            <a className="button secondary" href="/servers/arma3-cth">Open primary route</a>
            <a className="button secondary" href="/status">View status</a>
            <a className="button secondary" href="/hub-form">Open hub form</a>
          </div>

          <div className="entry-status-bar refined">
            {statusPills.map((item) => <span key={item}>{item}</span>)}
          </div>

          <div className="entry-telemetry-grid">
            <article className="telemetry-card">
              <span>Blackholes</span>
              <strong>{graph.stats.blackholes}</strong>
            </article>
            <article className="telemetry-card">
              <span>Solar systems</span>
              <strong>{graph.stats.solarSystems}</strong>
            </article>
            <article className="telemetry-card">
              <span>Dyson spheres</span>
              <strong>{graph.stats.dysonSpheres}</strong>
            </article>
            <article className="telemetry-card">
              <span>Expansion relays</span>
              <strong>{graph.stats.relays}</strong>
            </article>
          </div>

          <div className="entry-link-row compact">
            <a href="/privacy-policy">Privacy policy</a>
            <a href="/terms-and-conditions">Terms and conditions</a>
            <a href="/report-player">Report player</a>
            <a href="/donate">Support</a>
          </div>
        </div>

        <div className="entry-panel-grid enhanced simplified-grid">
          {launchCards.map((card) => (
            <article className="content-card entry-panel polished minimal-route-card" key={card.title}>
              <span className="entry-panel-kicker">{card.kicker}</span>
              <strong>{card.title}</strong>
              <p>{card.copy}</p>
              <a className="button secondary" href={card.href}>Open route</a>
            </article>
          ))}
          <article className="content-card entry-panel polished minimal-route-card">
            <span className="entry-panel-kicker">Support Route</span>
            <strong>Donation and subscriptions</strong>
            <p>
              Open the donation page to compare one-time and recurring support models, plus the benefits of PayPal integration for the T-Central Hub.
            </p>
            <a className="button secondary" href="/donate">Open donation page</a>
          </article>
          <article className="content-card entry-panel polished minimal-route-card">
            <span className="entry-panel-kicker">External Route</span>
            <strong>Matrixcoinexchange</strong>
            <p>
              Open the Matrixcoinexchange hotlink directly from the home launch surface, alongside donation and server route entries.
            </p>
            <a className="button secondary" href="https://matrixcoinexchange.com" target="_blank" rel="noreferrer">
              Open Matrixcoinexchange
            </a>
          </article>
        </div>

        <div className="arma-brief-grid">
          <article className="content-card">
            <p className="eyebrow">Features</p>
            <h3>Independent + co-dependent route design</h3>
            <ul className="arma-list">
              <li>Each route page works independently with direct server details and join actions.</li>
              <li>All route pages also plug into one shared blackholes system with synchronized status visuals.</li>
              <li>Steam launch + connect links are available per server for rapid handoff from site to game.</li>
            </ul>
          </article>
          <article className="content-card">
            <p className="eyebrow">Perks & benefits</p>
            <h3>Faster onboarding, cleaner flow</h3>
            <ul className="arma-list">
              <li>Server IP, mode, and map are surfaced before players commit to a route.</li>
              <li>Descriptions stay mode-specific so new users understand each game loop quickly.</li>
              <li>Status and route context remain visible while the cinematic background stays active.</li>
            </ul>
          </article>
          <article className="content-card">
            <p className="eyebrow">Connection points</p>
            <h3>Steam API style quick-entry paths</h3>
            <div className="system-news-list">
              {featuredRoutes.map((route) => (
                <a className="system-news-link" href={route.href} key={route.id}>
                  <span>{route.shortTitle}</span>
                  <small>
                    {route.ip} • {route.mode}
                  </small>
                </a>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
