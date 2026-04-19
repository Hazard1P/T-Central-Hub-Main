'use client';

import { useEffect, useRef, useState } from 'react';
import { useSteamSession } from '@/components/SteamSessionProvider';

function loadPayPalSdk({ clientId, currency }) {
  const scriptId = 'paypal-donation-sdk';
  const existing = document.getElementById(scriptId);
  const src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture`;

  if (existing && existing.getAttribute('src') === src) {
    return Promise.resolve();
  }

  if (existing) existing.remove();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('PayPal SDK failed to load'));
    document.body.appendChild(script);
  });
}

export default function DonateSupportClient() {
  const containerRef = useRef(null);
  const { steamUser, support, refresh } = useSteamSession();
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('');
  const [amount, setAmount] = useState('10.00');
  const [anchorSlug, setAnchorSlug] = useState('deep_blackhole');
  const [solarSystemKey, setSolarSystemKey] = useState('solar_system');
  const [donationSummary, setDonationSummary] = useState(null);

  useEffect(() => {
    fetch('/api/donations/paypal/config', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setConfig(data?.ok ? data : null))
      .catch(() => setConfig(null));

    fetch('/api/donations/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setDonationSummary(data?.summary || null))
      .catch(() => setDonationSummary(null));
  }, []);

  useEffect(() => {
    if (!config?.configured || !config?.clientId || !containerRef.current || !steamUser?.steamid) return;

    let cancelled = false;

    loadPayPalSdk({ clientId: config.clientId, currency: config.currency })
      .then(() => {
        if (cancelled || !window.paypal || !containerRef.current) return;
        containerRef.current.innerHTML = '';
        window.paypal.Buttons({
          style: { shape: 'rect', color: 'gold', layout: 'vertical', label: 'donate' },
          createOrder: async () => {
            setStatus('Creating protected donation order...');
            const response = await fetch('/api/donations/paypal/create-order', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ amount, currency: config.currency, anchorSlug, solarSystemKey }),
            });
            const data = await response.json();
            if (!response.ok || !data?.orderId) {
              throw new Error(data?.error || 'Unable to create order');
            }
            setStatus('Order created. Awaiting approval...');
            return data.orderId;
          },
          onApprove: async (data) => {
            setStatus('Capturing donation...');
            const response = await fetch('/api/donations/paypal/capture-order', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ orderId: data.orderID }),
            });
            const payload = await response.json();
            if (!response.ok) {
              setStatus(payload?.error || 'Capture failed');
              return;
            }
            setDonationSummary(payload?.ledger || null);
            setStatus(`Donation confirmed for ${payload?.capture?.amount || amount} ${payload?.capture?.currency || config.currency}.`);
            refresh();
          },
          onCancel: () => setStatus('Donation cancelled.'),
          onError: (error) => setStatus(error?.message || 'PayPal checkout error'),
        }).render(containerRef.current);
      })
      .catch((error) => setStatus(error.message || 'Unable to load PayPal'));

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [config, steamUser, amount, anchorSlug, solarSystemKey, refresh]);

  return (
    <>
      <section className="content-card support-link-card">
        <p className="eyebrow">Protected Steam-bound donation flow</p>
        <h3>Donate through PayPal and bind support to your Steam-linked universe state</h3>
        <p className="muted">
          Your donation order is created on the server, tied to your authenticated Steam ID, and anchored to the selected blackhole and solar system.
        </p>

        <div className="support-link-grid">
          <div className="support-link-panel">
            <span className="support-link-label">Steam identity</span>
            <strong>{steamUser?.personaname || 'Not signed in'}</strong>
            <small>{steamUser?.steamid || 'Steam login required before donation'}</small>
          </div>

          <div className="support-link-panel">
            <span className="support-link-label">Support status</span>
            <strong>{support ? 'Linked' : 'Awaiting support receipt'}</strong>
            <small>{support?.reference || 'No active support receipt yet'}</small>
          </div>

          <div className="support-link-panel">
            <span className="support-link-label">Confirmed donations</span>
            <strong>{donationSummary?.confirmed ?? 0}</strong>
            <small>{donationSummary?.totalAmount ? `${donationSummary.totalAmount} ${config?.currency || 'USD'} confirmed` : 'No confirmed donations yet'}</small>
          </div>
        </div>

        <div className="donation-form-grid">
          <label className="donation-field">
            <span>Amount</span>
            <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
          </label>
          <label className="donation-field">
            <span>Blackhole anchor</span>
            <select value={anchorSlug} onChange={(event) => setAnchorSlug(event.target.value)}>
              <option value="deep_blackhole">Deep Blackhole</option>
              <option value="arma3-cth">ARMA 3 Route</option>
              <option value="rust-vanilla">Rust Vanilla</option>
              <option value="matrixcoinexchange">MatrixCoinExchange</option>
            </select>
          </label>
          <label className="donation-field">
            <span>Solar system</span>
            <select value={solarSystemKey} onChange={(event) => setSolarSystemKey(event.target.value)}>
              <option value="solar_system">Primary Solar System</option>
              <option value="rust_system">Rust System</option>
              <option value="arma_system">ARMA System</option>
              <option value="dyson_shell">Dyson Shell</option>
            </select>
          </label>
        </div>

        {status ? <p className="support-link-status">{status}</p> : null}
      </section>

      {!steamUser?.steamid ? (
        <div className="content-card donate-note-box">
          <strong>Steam login required</strong>
          <p>Sign in with Steam first so the donation can be cryptographically linked to your pilot and universe scope.</p>
        </div>
      ) : null}

      {config?.configured && steamUser?.steamid ? (
        <div className="paypal-live-shell">
          <div ref={containerRef} />
        </div>
      ) : null}
    </>
  );
}
