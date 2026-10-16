import PageShell from '@/components/PageShell';
import { PRIMARY_SERVER_ROUTES } from '@/lib/serverData';
import { WORLD_SUMMARY } from '@/lib/worldLayout';

export const metadata = { title: 'Project Status' };

export default function StatusPage() {
  return (
    <PageShell
      eyebrow="Project status"
      title="Hub status and server routes"
      text="Browse the configured universe and game server routes. These counts describe the hub layout; they do not confirm that external game servers are online."
    >
      <div className="arma-brief-grid">
        <article className="content-card">
          <p className="eyebrow">World counts</p>
          <h3>Generated system shell</h3>
          <ul className="arma-list">
            <li>{WORLD_SUMMARY.blackholes} blackholes in the world layout.</li>
            <li>{WORLD_SUMMARY.dysonSpheres} Dyson spheres in the universe.</li>
            <li>{WORLD_SUMMARY.solarSystems} solar system anchor.</li>
            <li>{WORLD_SUMMARY.nodes} total route and expansion nodes rendered from shared generators.</li>
          </ul>
        </article>

        <article className="content-card">
          <p className="eyebrow">Primary routes</p>
          <h3>{PRIMARY_SERVER_ROUTES.length} configured routes</h3>
          <div className="system-news-list">
            {PRIMARY_SERVER_ROUTES.map((server) => (
              <a className="system-news-link" href={server.href} key={server.id}>
                <span>{server.shortTitle}</span>
                <small>{server.ip}</small>
              </a>
            ))}
          </div>
        </article>

        <article className="content-card">
          <p className="eyebrow">Connection help</p>
          <h3>Before you connect</h3>
          <ul className="arma-list">
            <li>Open a server route to find its address and connection options.</li>
            <li>Steam launch links need the desktop Steam app and the matching game installed.</li>
            <li>If a connection fails, try joining with the listed address in-game or contact the team.</li>
          </ul>
        </article>
      </div>
    </PageShell>
  );
}
