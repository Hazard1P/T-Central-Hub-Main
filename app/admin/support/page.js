import PageShell from '@/components/PageShell';
import SupportAnalytics from '@/components/SupportAnalytics';
import { resolvePaymentAdmin } from '@/lib/auth/resolvePaymentAdmin';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Support administration', robots: { index: false, follow: false } };
export default function SupportAdminPage() {
  const { authorized, auth } = resolvePaymentAdmin();
  return <PageShell eyebrow="Private administration" title="Project support analytics" text="Account-bound payments, currency totals and reconciliation.">{authorized ? <SupportAnalytics provider={auth.provider} accountId={auth.accountId} /> : <section className="content-card"><h2>Authorized account required</h2><p>Financial analytics are restricted to the designated payment administrator.</p></section>}</PageShell>;
}
