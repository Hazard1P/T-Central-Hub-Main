import SteamLoginHud from '@/components/SteamLoginHud';
import CinematicUniverseCanvas from '@/components/CinematicUniverseCanvas';
import { getHomeLaunchCards, getHomeStatusPills } from '@/lib/siteContent';
import { buildUniverseGraph } from '@/lib/universeEngine';

export default function HomePage() {
  const launchCards = getHomeLaunchCards().slice(0, 3);
  const statusPills = getHomeStatusPills();
  const graph = buildUniverseGraph();

  return (
    <main className="entry-page cosmic-entry-page simplified-home-page">
      <CinematicUniverseCanvas mode="landing" className="entry-universe-canvas" />
      <SteamLoginHud />
      <div className="cosmic-overlay cinematic" />

      <section className="entry-shell simplified">
        <div className="entry-copy cosmic-hero-panel entry-hero-panel simplified-panel">
          <p className="eyebrow">T-Central Hub</p>
          <h1>Simple surface. Cinematic universe.</h1>
          <p className="muted max-copy">
            Enter a cleaner observer shell while blackholes, solar systems, deep-space anchors, and route ribbons stay alive behind it.
          </p>

          <div className="entry-actions">
            <a className="button primary" href="/system">Enter system</a>
            <a className="button secondary" href="/servers/arma3-cth">Open primary route</a>
            <a className="button secondary" href="/status">View status</a>
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
        </div>
      </section>
    </main>
  );
}
