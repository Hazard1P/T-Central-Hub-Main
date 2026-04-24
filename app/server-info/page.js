import PageShell from '@/components/PageShell';
import { PRIMARY_SERVER_ROUTES } from '@/lib/serverData';

export const metadata = { title: 'Server Info' };

export default function ServerInfoPage() {
  return (
    <PageShell
      eyebrow="World status"
      title="The web-base game is the live system."
      text="This project is being built as a shared 3D multiplayer space where players sign in, fly, spectate, and use blackholes as server-entry systems."
    >
      <div className="arma-brief-grid">
        <article className="content-card">
          <p className="eyebrow">Current direction</p>
          <h3>Live shared world</h3>
          <p className="muted">
            The 3D environment remains the actual web-game layer rather than a decorative landing page.
          </p>
        </article>
        <article className="content-card">
          <p className="eyebrow">Core roles</p>
          <h3>Pilot and spectate</h3>
          <p className="muted">
            Players can pilot ships, move through space, and observe the shared room while navigating to blackholes and server routes.
          </p>
        </article>
        <article className="content-card">
          <p className="eyebrow">Target</p>
          <h3>Persistent growth</h3>
          <p className="muted">
            Each package continues toward a fuller multiplayer simulator with better visuals, stronger sync, and deeper server interiors.
          </p>
        </article>
      </div>

      <div className="arma-brief-grid">
        <article className="content-card">
          <p className="eyebrow">Server registry</p>
          <h3>IP addresses + game modes</h3>
          <p className="muted">
            Every primary route includes direct address data, mode context, and quick links to route-specific briefing pages.
          </p>
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
          <p className="eyebrow">Mode briefing</p>
          <h3>What each route is for</h3>
          <ul className="arma-list">
            {PRIMARY_SERVER_ROUTES.map((server) => (
              <li key={`${server.id}-mode`}>
                <strong>{server.shortTitle}:</strong> {server.modeDescription || server.summary}
              </li>
            ))}
          </ul>
        </article>

        <article className="content-card">
          <p className="eyebrow">Steam connection points</p>
          <h3>Quick launch + quick connect</h3>
          <ul className="arma-list">
            {PRIMARY_SERVER_ROUTES.map((server) => (
              <li key={`${server.id}-steam`}>
                {server.shortTitle}: <code>{`steam://run/${server.steamAppId}`}</code> and <code>{`steam://connect/${server.ip}`}</code>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </PageShell>
  );
}
