import PageShell from '@/components/PageShell';
import { PRIMARY_SERVER_ROUTES } from '@/lib/serverData';
import { WORLD_SUMMARY } from '@/lib/worldLayout';

export const metadata = { title: 'Project Status' };

export default function StatusPage() {
  return (
    <PageShell
      eyebrow="Project status"
      title="Current conformance pass"
      text="This page summarizes the current stabilized direction of the T-Central package after the cleanup, dynamic route, and infinite-foundation passes."
    >
      <div className="arma-brief-grid">
        <article className="content-card">
          <p className="eyebrow">World counts</p>
          <h3>Generated system shell</h3>
          <ul className="arma-list">
            <li>{WORLD_SUMMARY.blackholes} blackholes active in the world layout.</li>
            <li>{WORLD_SUMMARY.dysonSpheres} Dyson spheres online.</li>
            <li>{WORLD_SUMMARY.solarSystems} solar system anchor online.</li>
            <li>{WORLD_SUMMARY.nodes} total route and expansion nodes rendered from shared generators.</li>
          </ul>
        </article>

        <article className="content-card">
          <p className="eyebrow">Primary routes</p>
          <h3>{PRIMARY_SERVER_ROUTES.length} synchronized</h3>
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
          <p className="eyebrow">Next strongest upgrades</p>
          <h3>Best upgrade path</h3>
          <ul className="arma-list">
            <li>Wire the live-status endpoint to a real status source.</li>
            <li>Persist moderation reports to a database or webhook destination.</li>
            <li>Extend generated world nodes into deeper 3D scene behaviors and travel states.</li>
          </ul>
        </article>
      </div>
    </PageShell>
  );
}
