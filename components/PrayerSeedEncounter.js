'use client';
import { createRequestId } from '@/lib/requestId';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isNearPrayerRelic, PRAYER_SEED_MAX_LENGTH } from '@/lib/prayerSeedDiscovery';
import { isInteractiveTarget } from '@/lib/flightInput';

export default function PrayerSeedEncounter({ telemetry, authenticated, onOpenChange, onBound, enabled = true }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const dialog = useRef(null);
  const trigger = useRef(null);
  const pending = useRef(null);
  const mounted = useRef(true);
  const near = isNearPrayerRelic(telemetry.position);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const show = useCallback(() => {
    if (saved) { setSaved(null); setBody(''); setStatus(''); }
    setOpen(true); onOpenChange(true);
  }, [onOpenChange, saved]);
  const close = useCallback(() => { if (saving) return; setOpen(false); onOpenChange(false); trigger.current?.focus(); }, [saving, onOpenChange]);
  useEffect(() => {
    const key = (event) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === 'Escape' && open) { event.preventDefault(); event.stopImmediatePropagation(); close(); }
      if (event.code === 'KeyE' && enabled && near && !open && !isInteractiveTarget(event.target)) { event.preventDefault(); show(); }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [near, open, enabled, close, show]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    dialog.current?.querySelector('textarea, a, button')?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [open]);

  async function plant(event) {
    event.preventDefault();
    if (saving || !body.trim() || !near) return;
    // Retain the same payload on a failed/ambiguous network response so retries cannot duplicate a seed.
    if (!pending.current) pending.current = { requestId: createRequestId(), body: body.trim(), position: [...telemetry.position], flightSignature: telemetry.quantum?.signature || 'flight-unresolved' };
    setSaving(true); setStatus('Binding your seed…');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('/api/universe/prayer-seeds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending.current), signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Your seed could not be saved.');
      if (!mounted.current) return;
      setSaved({ ...data.seed, storage: data.storage }); setStatus(''); pending.current = null; onBound?.();
    } catch (error) {
      if (mounted.current) setStatus(error.name === 'AbortError' ? 'The connection timed out. Retry to check and save this same seed.' : error.message);
    } finally { clearTimeout(timeout); if (mounted.current) setSaving(false); }
  }

  return <>
    {enabled && near && !open ? <button ref={trigger} className="prayer-signal" type="button" onClick={show}>A quiet signal <span>Listen · E</span></button> : null}
    {open ? <div className="prayer-veil"><section className="prayer-dialog" role="dialog" aria-modal="true" aria-labelledby="prayer-title" ref={dialog} onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const items = [...dialog.current.querySelectorAll('button:not(:disabled), textarea:not(:disabled), a[href]')];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <p className="eyebrow">You found a quiet place</p><h2 id="prayer-title">In-Prayer-Intelligence</h2>
      {saved ? <>
        <p>Your seed is bound to your account’s cyber-intelligence.</p>
        <blockquote>{saved.body}</blockquote>
        <p className="prayer-meta">Unix epoch <strong>{saved.epoch_unix}</strong><br />{saved.storage === 'development-local' ? 'Development storage · local to this server' : 'Saved privately to your account'}</p>
        <Link className="button primary" href="/profile">View account collection</Link>
      </> : authenticated ? <form onSubmit={plant}>
        <p>Leave a prayer, intention or thought. Your words and this flight’s signature stay privately linked to your account, wherever you explore.</p>
        <label htmlFor="prayer-words">Your intelligence seed</label>
        <textarea id="prayer-words" required maxLength={PRAYER_SEED_MAX_LENGTH} rows={4} value={body} disabled={saving} onChange={(event) => { setBody(event.target.value); pending.current = null; }} aria-describedby="prayer-privacy" />
        <p id="prayer-privacy" className="prayer-meta">{body.length}/{PRAYER_SEED_MAX_LENGTH} · Bound with the server’s Unix epoch time. Visible only to your account.</p>
        {!near ? <p role="status">The signal has faded. Close this window and move closer to leave a seed.</p> : null}
        <button className="button primary" type="submit" disabled={saving || !body.trim() || !near}>{saving ? 'Binding…' : 'Bind to my account'}</button>
      </form> : <>
        <p>This hidden place holds In-Prayer-Intelligence seeds. Sign in to bind your own words to your account’s cyber-intelligence.</p>
        <div className="exploration-actions"><a className="button primary" href="/api/auth/steam/login?redirectTo=/system">Continue with Steam</a><a className="button secondary" href="/api/auth/google/login?redirectTo=/system">Continue with Google</a></div>
      </>}
      <p role="status" className="prayer-feedback">{status}</p>
      <button type="button" className="prayer-close" onClick={close} disabled={saving}>Return to flight</button>
    </section></div> : null}
  </>;
}
