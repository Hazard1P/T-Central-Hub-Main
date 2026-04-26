'use client';

import { useEffect, useMemo, useState } from 'react';

export default function MainAreaGatewayStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const pull = async () => {
      try {
        const response = await fetch('/api/blackhole/gateway', { cache: 'no-store' });
        const data = await response.json();
        if (!active) return;
        if (!response.ok || !data?.ok) {
          setError(data?.error || 'Gateway telemetry unavailable.');
          return;
        }
        setStatus(data.gateway);
        setError('');
      } catch {
        if (!active) return;
        setError('Gateway telemetry unavailable.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void pull();
    const id = setInterval(() => void pull(), 12000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const checks = useMemo(() => status?.checks || [], [status]);
  const events = useMemo(() => status?.recentEvents || [], [status]);

  return (
    <article className="content-card entry-panel polished minimal-route-card">
      <span className="entry-panel-kicker">Main area gateway</span>
      <strong>Standalone Blackhole migration gateway</strong>
      <p>
        Live readiness for map coordinate translation, physics-layer validation, and migration protocol handling between Standalone Blackhole simulation and game space.
      </p>

      {loading ? <p className="muted">Loading gateway status…</p> : null}
      {error ? <p className="muted">{error}</p> : null}

      {status ? (
        <>
          <div className="entry-status-bar refined">
            <span>{status.ready ? 'Ready for migration' : 'Blocked'}</span>
            <span>Accepted: {status.totals?.accepted || 0}</span>
            <span>Rejected: {status.totals?.rejected || 0}</span>
          </div>

          <ul className="arma-list">
            {checks.map((check) => (
              <li key={check.key}>
                <strong>{check.passed ? 'PASS' : 'FAIL'}</strong> · {check.key}
              </li>
            ))}
          </ul>

          <div className="system-news-list">
            {(events.length ? events : [{ id: 'none', timestamp: null, status: 'idle', code: 'No migration events yet.' }]).map((event) => (
              <div className="system-news-link" key={event.id}>
                <span>{event.status} · {event.code}</span>
                <small>{event.timestamp ? new Date(event.timestamp).toLocaleString() : 'Awaiting migrations'}</small>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </article>
  );
}
