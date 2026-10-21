'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSteamSession } from '@/components/SteamSessionProvider';
import { minorToMoney, SUPPORT_FOCUS } from '@/lib/accountPayments';

const money = (value, currency) => `${minorToMoney(value, currency)} ${currency}`;
export default function ContributionHistory() {
  const { steamUser, googleUser, loading: authLoading } = useSteamSession();
  const ownerKey = steamUser ? `steam:${steamUser.steamid}` : googleUser ? `google:${googleUser.sub}` : '';
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/donations/me', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || 'Unable to load your records.');
      if (`${body.owner?.provider}:${body.owner?.accountId}` !== ownerKey) throw new Error('Your account changed. Refresh the page to continue.');
      setData(body); setError('');
    } catch (error) { setError(error.message); }
    finally { setLoading(false); }
  }, [ownerKey]);
  useEffect(() => {
    if (authLoading || !ownerKey) return;
    refresh();
    const visible = () => { if (!document.hidden) refresh(); };
    const timer = setInterval(visible, 30000);
    window.addEventListener('focus', visible);
    return () => { clearInterval(timer); window.removeEventListener('focus', visible); };
  }, [refresh, authLoading, ownerKey]);
  const visibleData = data && `${data.owner?.provider}:${data.owner?.accountId}` === ownerKey ? data : null;
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...visibleData }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'tcentral-displayed-contribution-records.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (authLoading) return <p role="status">Checking your account…</p>;
  if (!ownerKey) return <p>Sign in to see your private contribution history.</p>;
  return <section className="content-card contribution-history" aria-labelledby="contribution-history-title">
    <p className="eyebrow">Private account records</p><h2 id="contribution-history-title">Your contribution history</h2>
    <p>Verified payments stay associated with the account you used at checkout. Steam and Google accounts remain separate; sharing an email address does not merge payment histories.</p>
    <div className="entry-actions"><button className="button secondary" type="button" onClick={refresh} disabled={loading}>{loading ? 'Checking records…' : 'Refresh payment history'}</button><button className="button secondary" type="button" onClick={download} disabled={!visibleData}>Download displayed records</button></div>
    {error ? <p role="status">{error}</p> : null}
    {visibleData ? <>
      {visibleData.environment === 'sandbox' ? <p className="legal-draft-note">Sandbox test records. These are not real contributions and do not grant paid benefits.</p> : null}
      <div className="contribution-totals">{visibleData.analytics.totals.map((total) => <article key={total.currency}><h3>{total.currency}</h3><dl><dt>Recorded payments</dt><dd>{total.payments}</dd><dt>Gross contributions</dt><dd>{money(total.gross_minor, total.currency)}</dd><dt>Refunds and reversals</dt><dd>{money(total.refunded_minor, total.currency)}</dd><dt>Net recorded support</dt><dd>{money(total.net_minor, total.currency)}</dd></dl></article>)}</div>
      {!visibleData.analytics.paymentCount ? <p>No verified payments are shown for this account in this payment environment. Historical or external contributions may need reconciliation; contact support if a receipt is missing. A pending approval is not a confirmed payment.</p> : null}
      <div className="contribution-records">{visibleData.analytics.recent.map((record) => <article key={record.transaction_id}><h3>{record.description || 'Project contribution'}</h3><p>{money(record.amount_minor, record.currency)} · {record.status.replaceAll('_', ' ')} · {new Date(record.paid_at).toLocaleDateString()}</p><p>{SUPPORT_FOCUS[record.focus] || 'Whole project'} · {record.kind.replaceAll('_', ' ')}</p><small className="directory-address">Receipt: {record.transaction_id}</small>{record.refunded_minor !== '0' ? <p>Refunded or reversed: {money(record.refunded_minor, record.currency)}</p> : null}</article>)}</div>
      <p className="muted">Totals include all recorded verified payments; the list shows the latest 50. Subscription activation alone is not a payment. This history records support, not a cash balance or redeemable credits.</p>
      <h3>Future recognition and VIP</h3><p>Your recorded history can support future recognition or eligibility under separately announced terms. VIP plans are currently undefined and unavailable for purchase. Contributions do not automatically purchase future benefits.</p>
      {visibleData.analytics.benefits.map((benefit) => <p key={`${benefit.transactionId}:${benefit.key}`}>{benefit.terms.label || benefit.key}: {benefit.status}</p>)}
    </> : null}
  </section>;
}
