import Link from 'next/link';
import { cookies } from 'next/headers';
import AdminDysonAssetEditor from '@/components/AdminDysonAssetEditor';
import PageShell from '@/components/PageShell';
import { resolveAdminContext } from '@/lib/auth/resolveAdminContext';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dyson Admin' };

const loginRoutes = [
  { href: '/api/auth/steam/login?redirectTo=/admin/dyson', label: 'Sign in with Steam' },
  { href: '/api/auth/google/login?redirectTo=/admin/dyson', label: 'Sign in with Google' },
];

function AdminPanel({ eyebrow, title, text, children }) {
  return (
    <article className="content-card">
      <p className="eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
      <p className="muted">{text}</p>
      {children}
    </article>
  );
}

function LoginRequiredPanel() {
  return (
    <AdminPanel
      eyebrow="Authentication required"
      title="Sign in before opening Dyson administration"
      text="Dyson asset administration is protected on the server. Authenticate with an existing account route before the editor can be mounted."
    >
      <div className="system-news-list">
        {loginRoutes.map((route) => (
          <Link className="system-news-link" href={route.href} key={route.href}>
            <span>{route.label}</span>
            <small>Return to /admin/dyson after login</small>
          </Link>
        ))}
      </div>
    </AdminPanel>
  );
}

function AccessDeniedPanel({ adminContext }) {
  const reason = adminContext.reason === 'ADMIN_NOT_CONFIGURED'
    ? 'No admin account is configured for this deployment.'
    : 'Your signed-in account is not the configured admin account.';

  return (
    <AdminPanel
      eyebrow="Access denied"
      title="This account cannot edit Dyson assets"
      text={`${reason} The editor is intentionally not mounted for this request.`}
    >
      <ul className="arma-list">
        <li>Provider: {adminContext.authContext.provider || 'unknown'}</li>
        <li>Account: {adminContext.authContext.displayName || adminContext.authContext.accountId || 'unknown'}</li>
      </ul>
    </AdminPanel>
  );
}

function getEditorAdminContext(adminContext) {
  return {
    ok: adminContext.ok,
    authContext: {
      provider: adminContext.authContext.provider,
      displayName: adminContext.authContext.displayName,
      identityKind: adminContext.authContext.identityKind,
    },
  };
}

export default function AdminDysonPage() {
  const cookieStore = cookies();
  const adminContext = resolveAdminContext(cookieStore);
  const editorAdminContext = adminContext.ok === true ? getEditorAdminContext(adminContext) : null;

  return (
    <PageShell
      eyebrow="Admin · Dyson assets"
      title="Dyson asset controls"
      text="Server-side account resolution protects the Dyson editor before any client component is allowed to mount."
    >
      {!adminContext.authenticated ? <LoginRequiredPanel /> : null}
      {adminContext.authenticated && !adminContext.ok ? <AccessDeniedPanel adminContext={adminContext} /> : null}
      {adminContext.ok === true ? <AdminDysonAssetEditor adminContext={editorAdminContext} /> : null}
    </PageShell>
  );
}
