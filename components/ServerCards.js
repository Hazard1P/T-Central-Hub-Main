import Link from 'next/link';
import { PRIMARY_SERVER_ROUTES } from '@/lib/serverData';

export default function ServerCards() {
  return (
    <div className="card-grid two">
      {PRIMARY_SERVER_ROUTES.map((server) => (
        <article key={server.id} className="content-card server-card animated-card">
          <p className="eyebrow">{server.ip}</p>
          <h3>{server.title}</h3>
          <p className="muted">{server.summary}</p>
          <div className="server-inline-meta">
            <span>{server.game}</span>
            <span>{server.wipeCadence || server.mode}</span>
            <span>{server.maxPlayers ? `${server.maxPlayers} max` : 'Capacity evolving'}</span>
          </div>
          <Link href={server.href} className="button secondary">
            Open page
          </Link>
        </article>
      ))}
    </div>
  );
}
