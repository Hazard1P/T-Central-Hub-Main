'use client';
import { useState } from 'react';
import { useSteamSession } from '@/components/SteamSessionProvider';
import { minorToMoney, SUPPORT_FOCUS } from '@/lib/accountPayments';
export default function SupportAnalytics({ provider: expectedProvider, accountId: expectedAccount }) {
  const { steamUser, googleUser, loading: authLoading } = useSteamSession();
  const providerNow = steamUser ? 'steam' : googleUser ? 'google' : null;
  const accountNow = steamUser?.steamid || googleUser?.sub;
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState(''), [accountId, setAccountId] = useState('');
  async function load(event) {
    event.preventDefault(); setLoading(true);
    try {
      const params = provider ? `?${new URLSearchParams({ provider, accountId })}` : '';
      const response = await fetch(`/api/admin/support/analytics${params}`, { cache: 'no-store' });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setData(body); setError('');
    } catch (error) { setError(error.message); } finally { setLoading(false); }
  }
  if (authLoading || providerNow !== expectedProvider || accountNow !== expectedAccount) return <p>Sign in with the designated payment administrator account.</p>;
  return <section className="content-card contribution-history"><h2>Verified project funding</h2><p>Private financial reporting from recorded transactions. Currency totals are separate. Funding preferences describe supporter intent, not actual expenditure or restricted funds.</p>
    <form className="community-feed-tools" onSubmit={load}><label>Account provider<select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="">All accounts</option><option value="steam">Steam</option><option value="google">Google</option></select></label>{provider ? <label>Account identifier<input value={accountId} onChange={(event) => setAccountId(event.target.value)} maxLength={160} required /></label> : null}<button className="button primary" disabled={loading}>{loading ? 'Loading…' : 'Load financial analytics'}</button></form>
    {error ? <p role="status">{error}</p> : null}{data ? <><p>{data.environment === 'sandbox' ? 'Sandbox test analytics — not live project revenue.' : 'Live payment records.'}</p><p>{data.analytics.paymentCount} recorded payments · {data.unmatchedEvents} unmatched provider events require reconciliation.</p><div className="contribution-totals">{data.analytics.totals.map((total) => <article key={total.currency}><h3>{total.currency}</h3><p>Gross: {minorToMoney(total.gross_minor,total.currency)}</p><p>Refunds/reversals: {minorToMoney(total.refunded_minor,total.currency)}</p><p>Net: {minorToMoney(total.net_minor,total.currency)}</p></article>)}</div><h3>Support type and intended focus</h3>{data.analytics.groups.map((group) => <p key={`${group.currency}:${group.kind}:${group.focus}`}>{group.kind.replaceAll('_',' ')} · {SUPPORT_FOCUS[group.focus]} · {minorToMoney(group.net_minor,group.currency)} {group.currency} · {group.payments} payments</p>)}</> : null}
  </section>;
}
