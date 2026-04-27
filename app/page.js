import SteamLoginHud from '@/components/SteamLoginHud';
import CinematicUniverseCanvas from '@/components/CinematicUniverseCanvas';
import { getHomeLaunchCards, getHomeStatusPills } from '@/lib/siteContent';
import { buildUniverseGraph } from '@/lib/universeEngine';
import { getEconomyReadModel } from '@/lib/economyReadModel';
import MainAreaGatewayStatus from '@/components/MainAreaGatewayStatus';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export default async function HomePage() {
  const launchCards = getHomeLaunchCards().slice(0, 3);
  const statusPills = getHomeStatusPills();
  const graph = buildUniverseGraph();
  const economy = getEconomyReadModel();

  const entropyReportPath = path.join(process.cwd(), 'public', 'reports', 'entropy-release-latest.meta.json');
  const entropyReport = await fs
    .readFile(entropyReportPath, 'utf8')
    .then((raw) => JSON.parse(raw))
    .catch(() => null);

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
            The front page now acts as mission control for your web layer and in-game 3D/5D game simulation system: discover routes, read mode briefs, and jump
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


          <div className="entry-telemetry-grid">
            <article className="telemetry-card">
              <span>Entropic credits (available)</span>
              <strong>{economy.ui.available_ec}</strong>
            </article>
            <article className="telemetry-card">
              <span>Entropic credits (reserved)</span>
              <strong>{economy.ui.reserved_ec}</strong>
            </article>
            <article className="telemetry-card">
              <span>Settlement queue</span>
              <strong>{economy.settlement_state.pending_count}</strong>
            </article>
            <article className="telemetry-card">
              <span>Mode scope</span>
              <strong>{economy.wallet.mode_scope}</strong>
            </article>
          </div>
          <p className="muted max-copy">
            Entropic credit status is available from the canonical read model endpoint at
            {' '}<code>/api/economy-read-model</code> for Main Area visibility.
          </p>

          <article className="content-card entry-panel polished minimal-route-card" style={{ marginTop: '1rem' }}>
            <span className="entry-panel-kicker">Entropy Bulletin</span>
            <strong>Signed entropy release PDF</strong>
            <p>
              Cross-check the latest ring3 entropy release and continuity snapshot digest.
              {entropyReport?.generatedAt ? ` Generated at ${entropyReport.generatedAt}.` : ' Generate it with scripts/generate-entropy-frontpage-pdf.mjs.'}
            </p>
            <p className="muted" style={{ wordBreak: 'break-all' }}>
              SHA-256: {entropyReport?.sha256 || 'pending-generation'}
            </p>
            <div className="entry-actions">
              <a className="button secondary" href={entropyReport?.url || '/reports/entropy-release-latest.pdf'} target="_blank" rel="noreferrer">
                Open entropy PDF
              </a>
              <a className="button secondary" href="/api/reports/entropy-release" target="_blank" rel="noreferrer">
                Open metadata API
              </a>
            </div>
          </article>

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
          <MainAreaGatewayStatus />
        </div>
      </section>
    </main>
  );
}
