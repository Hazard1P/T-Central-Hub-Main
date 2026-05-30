import Link from 'next/link';
import { cookies } from 'next/headers';
import { resolveGameAuthContext } from '@/lib/auth/resolveGameAuthContext';

function hasAdminAccess(authContext) {
  const steamUser = authContext?.steamUser;
  const googleUser = authContext?.googleUser;

  return Boolean(
    steamUser?.is_admin ||
    steamUser?.isAdmin ||
    steamUser?.role === 'admin' ||
    googleUser?.is_admin ||
    googleUser?.isAdmin ||
    googleUser?.role === 'admin'
  );
}

export default function AdminDysonPage() {
  const authContext = resolveGameAuthContext(cookies());
  const isAuthenticated = Boolean(authContext.authenticated);
  const isAdmin = hasAdminAccess(authContext);
  const displayName = authContext.displayName || 'Admin operator';

  return (
    <main className="content-page admin-dyson-page">
      <div className="content-backdrop" />

      <nav className="content-bubbles" aria-label="Admin navigation">
        <Link className="bubble-link" href="/">Return to gateway</Link>
        <Link className="bubble-link" href="/system">Enter system</Link>
        <Link className="bubble-link" href="/status">View status</Link>
      </nav>

      <section className="page-hero">
        <p className="eyebrow">Authenticated Admin Entry</p>
        <h1>Admin Dyson Controls</h1>
        <p className="muted">
          Protected command access for Dyson continuity operations. Parameter-edit controls remain off the public homepage and are only surfaced after an authenticated admin session is verified.
        </p>
      </section>

      <section className="page-section">
        <div className="info-grid two">
          <article className="content-card entry-panel polished minimal-route-card">
            <span className="entry-panel-kicker">Access Status</span>
            <strong>{isAdmin ? 'Admin session verified' : isAuthenticated ? 'Signed in, admin role required' : 'Authentication required'}</strong>
            <p>
              {isAdmin
                ? `${displayName} is cleared for the Dyson admin command surface.`
                : isAuthenticated
                  ? `${displayName} is signed in, but this route requires an admin role before Dyson controls are shown.`
                  : 'Sign in with the configured admin Steam account to unlock the Dyson control surface.'}
            </p>
            <div className="entry-actions">
              {isAdmin ? (
                <Link className="button primary" href="/system">Open command view</Link>
              ) : (
                <a className="button primary" href="/api/auth/steam/login?redirectTo=/admin/dyson">Authenticate admin</a>
              )}
              <Link className="button secondary" href="/">Back to gateway</Link>
            </div>
          </article>

          <article className="content-card entry-panel polished minimal-route-card">
            <span className="entry-panel-kicker">Dyson Continuity</span>
            <strong>{isAdmin ? 'Protected controls ready' : 'Controls locked'}</strong>
            <p>
              {isAdmin
                ? 'Use the protected admin session as the entry point for Dyson continuity actions and operational reviews.'
                : 'No parameter-edit controls are exposed here until the request is backed by an authenticated admin session.'}
            </p>
            <div className="entry-actions">
              {isAdmin ? (
                <a className="button secondary" href="/api/continuity/health" target="_blank" rel="noreferrer">Open continuity health</a>
              ) : null}
              <Link className="button secondary" href="/status">Review public status</Link>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
