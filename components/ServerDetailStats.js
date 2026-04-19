import Link from 'next/link';
import PageShell from '@/components/PageShell';
import ServerConnectActions from '@/components/ServerConnectActions';
import ProceduralRoutePreview from '@/components/ProceduralRoutePreview';
import { getRelatedServers } from '@/lib/serverData';

export default function ServerDetailStats({ server }) {
  if (!server) {
    return (
      <PageShell eyebrow="Server" title="Route unavailable" text="This server route could not be resolved from the shared server registry." />
    );
  }

  const relatedServers = getRelatedServers(server);

  return (
    <PageShell eyebrow={server.shortTitle} title={server.detailTitle} text={server.detailText}>
      <div className="arma-entry-grid">
        <article className="content-card">
          <p className="eyebrow">Quick connect</p>
          <h3>{server.ip}</h3>
          <p className="muted">Launch through Steam, copy the server address, or use a direct handoff into the selected route.</p>
          <ServerConnectActions
            serverIp={server.ip}
            steamAppId={server.steamAppId || '107410'}
            launchLabel={server.launchLabel || 'Launch Game'}
            connectLabel={server.connectLabel || 'Quick Connect'}
          />
          <div className="server-inline-meta">
            <span>Game: {server.game}</span>
            <span>{server.wipeCadence ? `Cycle: ${server.wipeCadence}` : `Mode: ${server.mode}`}</span>
            <span>Tier: {server.tier}</span>
          </div>
        </article>

        <article className="content-card arma-hero-image-card">
          <ProceduralRoutePreview title={server.title} accent={server.color || '#7dd3fc'} detail={server.summary} />
        </article>
      </div>

      <div className="info-grid three">
        {server.detailStats.map((stat) => (
          <article className="content-card" key={`${server.id}-${stat.label}`}>
            <p className="eyebrow">{stat.label}</p>
            <h3>{stat.value}</h3>
          </article>
        ))}
      </div>

      {relatedServers.length ? (
        <div className="arma-brief-grid">
          <article className="content-card">
            <p className="eyebrow">Related routes</p>
            <h3>{server.family === 'rust' ? 'Other Rust routes' : 'Related routes'}</h3>
            <div className="system-news-list">
              {relatedServers.map((related) => (
                <Link className="system-news-link" href={related.href} key={related.id}>
                  <span>{related.shortTitle}</span>
                  <small>{related.summary}</small>
                </Link>
              ))}
            </div>
          </article>
        </div>
      ) : null}
    </PageShell>
  );
}
