'use client';

import { useEffect, useState } from 'react';
import { REPORT_SERVER_OPTIONS } from '@/lib/serverData';
import PageShell from '@/components/PageShell';
import ModerationQueuePanel from '@/components/ModerationQueuePanel';

const initialForm = {
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

    fetch('/api/auth/steam/session', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setSession(data?.authenticated ? data.user : null);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
      });

    fetch('/api/report-player', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setPublicMeta(data?.publicMeta || null);
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
        body: JSON.stringify(form),
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
    <PageShell eyebrow="T-Central moderation" title="Report a player" text="Report cheating, griefing, abuse, or rule violations. Include the server, player name, and evidence so the team can investigate.">
      <section className="report-shell report-shell--shared" aria-label="Player report form">
        <div className="report-identity">
          <div>
            <span className="report-label">Reporter identity</span>
            <strong>{session?.personaname || 'Guest reporter'}</strong>
            <small>{session?.steamid || 'Steam login recommended for linked reports'}</small>
          </div>
        </div>

        <ModerationQueuePanel summary={publicMeta} />

        <form className="report-form" onSubmit={onSubmit} aria-busy={status.state === 'loading'}>
          <label>
            <span>Reported player</span>
            <input value={form.reportedPlayer} onChange={(e) => onChange('reportedPlayer', e.target.value)} required />
          </label>

          <label>
            <span>Server</span>
            <select value={form.server} onChange={(e) => onChange('server', e.target.value)}>
              {REPORT_SERVER_OPTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Reason</span>
            <input value={form.reason} onChange={(e) => onChange('reason', e.target.value)} required />
          </label>

          <label>
            <span>Evidence link or notes</span>
            <textarea rows="6" value={form.evidence} onChange={(e) => onChange('evidence', e.target.value)} required />
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
