'use client';

import { useState } from 'react';

const initial = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
  company: '',
};

export default function ContactUsForm() {
  const [form, setForm] = useState(initial);
  const [state, setState] = useState({ status: '', ok: false, reference: '' });

  async function handleSubmit(event) {
    event.preventDefault();
    setState({ status: 'Sending transmission...', ok: false, reference: '' });

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const directEmail = data?.directEmail ? ` Contact directly: ${data.directEmail}.` : '';
        setState({ status: `${data?.error || 'Unable to send message right now.'}${directEmail}`, ok: false, reference: '' });
        return;
      }

      setState({
        status: data?.message || 'Message received.',
        ok: true,
        reference: data?.reference || '',
      });
      setForm({ ...initial, subject: '', message: '', company: '' });
    } catch {
      setState({
        status: 'Contact service is unavailable right now. Please use direct email instead.',
        ok: false,
        reference: '',
      });
    }
  }

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div className="donation-form-grid">
        <label className="donation-field">
          <span>Name</span>
          <input
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="Your full name"
            required
            maxLength={120}
          />
        </label>
        <label className="donation-field">
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => update('email', event.target.value)}
            placeholder="you@example.com"
            required
            maxLength={160}
          />
        </label>
        <label className="donation-field">
          <span>Phone</span>
          <input
            value={form.phone}
            onChange={(event) => update('phone', event.target.value)}
            placeholder="(555) 123-4567"
            maxLength={40}
          />
        </label>
      </div>

      <label className="donation-field contact-field-wide">
        <span>Subject</span>
        <input value={form.subject} onChange={(event) => update('subject', event.target.value)} required maxLength={140} />
      </label>

      <label className="donation-field contact-field-wide honeypot-field" aria-hidden="true">
        <span>Company</span>
        <input tabIndex={-1} autoComplete="off" value={form.company} onChange={(event) => update('company', event.target.value)} />
      </label>

      <label className="donation-field contact-field-wide">
        <span>Message</span>
        <textarea value={form.message} onChange={(event) => update('message', event.target.value)} required rows={7} maxLength={2500} />
      </label>

      <div className="contact-actions">
        <button className="button primary" type="submit">Send message</button>
        <a className="button secondary" href="mailto:BrainandBodyai@gmail.com">Email directly</a>
      </div>

      {state.status ? (
        <p className={`report-status ${state.ok ? 'success' : 'error'}`}>
          {state.status} {state.reference ? <span>Reference: {state.reference}</span> : null}
        </p>
      ) : null}
    </form>
  );
}
