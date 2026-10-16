'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { buildContactDraft, CONTACT_EMAIL, CONTACT_TOPICS } from '@/lib/contact';

const initial = { name: '', email: '', subject: '', message: '', company: '', topic: CONTACT_TOPICS[0] };

export default function ContactUsForm({ enabled = false }) {
  const [form, setForm] = useState(initial);
  const [state, setState] = useState({ status: '', kind: '', reference: '' });
  const [submitting, setSubmitting] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const pending = useRef(false);
  const draft = buildContactDraft(form);

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending.current) return;
    setCopyStatus('');
    if (!form.subject.trim() || !form.message.trim() || (enabled && (!form.name.trim() || !form.email.trim()))) {
      setState({ status: 'Please fill in the required fields with your message details.', kind: 'error' });
      return;
    }
    if (!enabled) {
      setShowDraft(true);
      setState({ status: 'Draft ready. Open it in your email app to review and send.', kind: 'success' });
      return;
    }

    pending.current = true;
    setSubmitting(true);
    setShowDraft(false);
    setState({ status: 'Sending your message…', kind: 'loading' });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, subject: draft.subject, message: `Topic: ${form.topic}\n\n${form.message.trim()}` }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true) throw new Error('contact-unavailable');
      setState({ status: 'Message received. The team can follow up at the email you provided.', kind: 'success', reference: data.reference || '' });
      setForm({ ...initial });
    } catch {
      setState({ status: 'Your message could not be confirmed. Your details are still here; you can retry or send the email draft below.', kind: 'error' });
      setShowDraft(true);
    } finally {
      clearTimeout(timeout);
      pending.current = false;
      setSubmitting(false);
    }
  }

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setState({ status: '', kind: '' });
    setCopyStatus('');
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(`To: ${CONTACT_EMAIL}\nSubject: ${draft.subject}\n\n${draft.body}`);
      setCopyStatus('Draft copied. Paste it into your email app to send.');
    } catch {
      setCopyStatus('Copy is unavailable. Select the draft text below and copy it into your email app.');
    }
  }

  return (
    <article className="content-card contact-compose" aria-labelledby="contact-form-title">
      <div className="contact-compose-heading">
        <p className="eyebrow">Start a conversation</p>
        <span className="contact-mode">{enabled ? 'Online form' : 'Email draft'}</span>
      </div>
      <h2 id="contact-form-title">Tell us what’s happening.</h2>
      <p className="muted" id="contact-form-help">
        {enabled ? 'Send a question to the team. Fields marked * are required.' : 'Online submissions are unavailable. Prepare a draft here, then review and send it in your own email app. Only the subject and message are required.'}
        {' '}<a href={`mailto:${CONTACT_EMAIL}`}>Email us directly</a> if you prefer.
      </p>

      <form className="contact-form" onSubmit={handleSubmit} aria-describedby="contact-form-help" aria-busy={submitting}>
        <fieldset disabled={submitting}>
          <legend className="contact-visually-hidden">Your message</legend>
          <label className="contact-field">
            <span>What can we help with?</span>
            <select value={form.topic} onChange={(event) => update('topic', event.target.value)}>
              {CONTACT_TOPICS.map((topic) => <option key={topic}>{topic}</option>)}
            </select>
          </label>
          <div className="contact-field-grid">
            <label className="contact-field">
              <span>Name {enabled ? '*' : '(optional)'}</span>
              <input name="name" value={form.name} onChange={(event) => update('name', event.target.value)} autoComplete="name" placeholder="What should we call you?" required={enabled} maxLength={120} />
            </label>
            <label className="contact-field">
              <span>Reply email {enabled ? '*' : '(optional)'}</span>
              <input name="email" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} autoComplete="email" placeholder="you@example.com" required={enabled} maxLength={160} />
            </label>
          </div>
          <label className="contact-field">
            <span>Subject *</span>
            <input name="subject" value={form.subject} onChange={(event) => update('subject', event.target.value)} placeholder="A short summary of your question" required maxLength={140} />
          </label>
          <label className="contact-visually-hidden" aria-hidden="true">
            <span>Company</span>
            <input name="company" tabIndex={-1} autoComplete="off" value={form.company} onChange={(event) => update('company', event.target.value)} />
          </label>
          <label className="contact-field">
            <span id="contact-message-label">Message *</span>
            <textarea name="message" value={form.message} onChange={(event) => update('message', event.target.value)} placeholder="Tell us what happened and how we can help…" required rows={7} maxLength={2500} aria-labelledby="contact-message-label" aria-describedby="contact-message-help" />
            <span className="contact-field-hint">
              <small id="contact-message-help">For a technical issue, include the server, device and steps to reproduce it.</small>
              <small aria-hidden="true">{form.message.length}/2500</small>
            </span>
          </label>
          <div className="contact-actions">
            <button className="button primary" type="submit">{submitting ? 'Sending…' : enabled ? 'Send message' : 'Prepare email draft'}</button>
            <span className="contact-send-note">{enabled ? 'We’ll reply by email.' : 'You send it from your email app.'}</span>
          </div>
        </fieldset>
        <p className={`contact-status ${state.kind}`} role="status" aria-live="polite">
          {state.status} {state.reference ? <span>Reference: {state.reference}</span> : null}
        </p>
      </form>

      {showDraft ? (
        <section className="contact-draft" aria-labelledby="contact-draft-title">
          <h3 id="contact-draft-title">Your email draft</h3>
          <p className="muted">{!enabled ? 'Nothing has been sent. ' : ''}Open your email app, or copy this draft into your preferred email service.</p>
          <div className="contact-actions">
            <a className="button primary" href={draft.href}>Open email draft</a>
            <button className="button secondary" type="button" onClick={copyDraft}>Copy draft</button>
          </div>
          <p className="contact-helper" role="status">{copyStatus}</p>
          <details>
            <summary>Preview draft text</summary>
            <pre>{`To: ${CONTACT_EMAIL}\nSubject: ${draft.subject}\n\n${draft.body}`}</pre>
          </details>
        </section>
      ) : null}
      <p className="contact-privacy">Please leave out passwords and payment card details. See our <Link href="/privacy-policy">privacy policy</Link> for how we handle your information.</p>
    </article>
  );
}
