'use client';

import { useEffect, useState } from 'react';
import { REPORT_SERVER_OPTIONS } from '@/lib/serverData';
import PageShell from '@/components/PageShell';
import ModerationQueuePanel from '@/components/ModerationQueuePanel';

const initialForm = {
  chatMessageId: '',
  targetKey: '',
  reportedPlayer: '',
  server: REPORT_SERVER_OPTIONS[0],
  reason: '',
  evidence: '',
};

export default function ReportPlayerPage() {
  const [session, setSession] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const [publicMeta, setPublicMeta] = useState(null);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    setForm(prev => ({...prev, reportedPlayer: params.get('player') || '', targetKey: params.get('account') || '', chatMessageId:params.get('message') || '', server: params.has('message') ? 'T-Central community chat' : params.has('player') ? 'T-Central shared universe' : prev.server, evidence:params.has('message') ? 'Community chat message reference: '+params.get('message') : prev.evidence}));

    fetch('/api/report-player', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setPublicMeta(data?.publicMeta || null);
        setSession(data?.authenticated ? { displayName: data.reporterName } : null);
      })
      .catch(() => {
        if (!active) return;
        setPublicMeta(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (status.state === 'loading') return;
    setStatus({ state: 'loading', message: 'Submitting report…' });

    try {
      const res = await fetch('/api/report-player', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({...form, targetKey: form.targetKey || null}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Report failed');
      setStatus({
        state: 'success',
        message: `Report submitted. Reference: ${data.reference}. Your report has been received.`,
      });
      setForm(initialForm);
      const refreshSummary = await fetch('/api/report-player', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
      setPublicMeta(refreshSummary?.publicMeta || publicMeta);
    } catch (err) {
      setStatus({ state: 'error', message: err.message || 'Report failed' });
    }
  };

  return (
    <PageShell eyebrow="T-Central moderation" title="Report a player" text="Report concerns in T-Central spaces with the player name, location and relevant evidence. Independent Rust and Arma server operators handle moderation on their own servers; contact their admins for server-specific incidents.">
      <section className="report-shell report-shell--shared" aria-label="Player report form">
        <div className="report-identity">
          <div>
            <span className="report-label">Reporter identity</span>
            <strong>{session?.displayName || 'Guest reporter'}</strong>
            <small>{session ? 'Linked to your signed-in account' : 'Sign in with Google or Steam to link your report'}</small>
          </div>
        </div>

        {form.chatMessageId ? <p className="muted">Chat message reference: <code>{form.chatMessageId}</code></p> : null}
        <ModerationQueuePanel summary={publicMeta} />

        <form className="report-form" onSubmit={onSubmit} aria-busy={status.state === 'loading'}>
          <label>
            <span>Reported player</span>
            <input maxLength={160} value={form.reportedPlayer} onChange={(e) => onChange('reportedPlayer', e.target.value)} required />
          </label>

          <label><span>Account ID (optional)</span><input maxLength={170} value={form.targetKey} onChange={e => onChange('targetKey', e.target.value)} placeholder="google:… or steam:…" /><small>Reporting from the pilot roster fills this in. Leave blank if unknown; moderators will verify the account.</small></label>

          <label>
            <span>Server</span>
            <select value={form.server} onChange={(e) => onChange('server', e.target.value)}>
              {['T-Central shared universe', 'T-Central community chat', ...REPORT_SERVER_OPTIONS].map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Reason</span>
            <input maxLength={500} list="report-reasons" value={form.reason} onChange={(e) => onChange('reason', e.target.value)} required />
          </label>

          <datalist id="report-reasons">{publicMeta?.allowedReasons?.map(reason => <option key={reason} value={reason} />)}</datalist>
          <label>
            <span>Evidence link or notes</span>
            <textarea maxLength={5000} rows="6" value={form.evidence} onChange={(e) => onChange('evidence', e.target.value)} required />
          </label>

          <div className="report-actions">
            <button type="submit" className="report-submit" disabled={status.state === 'loading'}>{status.state === 'loading' ? 'Submitting…' : 'Submit report'}</button>
            <a href="/" className="report-back">Back to hub</a>
          </div>

          {status.message ? (
            <p role="status" className={`report-status ${status.state}`}>{status.message}</p>
          ) : null}
        </form>
      </section>
    </PageShell>
  );
}
