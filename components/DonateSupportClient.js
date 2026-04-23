'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSteamSession } from '@/components/SteamSessionProvider';

function buildSdkSrc({ clientId, currency, mode }) {
  const params = new URLSearchParams({
    'client-id': clientId,
    components: 'buttons',
    currency,
  });

  if (mode === 'subscription') {
    params.set('vault', 'true');
    params.set('intent', 'subscription');
  } else {
    params.set('intent', 'capture');
  }

  return `https://www.paypal.com/sdk/js?${params.toString()}`;
}

function loadPayPalSdk({ clientId, currency, mode }) {
  const scriptId = 'paypal-donation-sdk';
  const existing = document.getElementById(scriptId);
  const src = buildSdkSrc({ clientId, currency, mode });

  if (existing && existing.getAttribute('src') === src) {
    return Promise.resolve();
  }

  if (existing) {
    existing.remove();
    delete window.paypal;
  }

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

function LoginCallout({ currentPath = '/donate' }) {
  return (
    <div className="content-card donate-note-box">
      <strong>Steam login required</strong>
      <p>Sign in with Steam first so donations and memberships can be securely linked to your pilot and universe scope.</p>
      <a className="button primary" href={`/api/auth/steam/login?redirectTo=${encodeURIComponent(currentPath)}`}>
        Continue with Steam
      </a>
    </div>
  );
}

export default function DonateSupportClient() {
  const orderContainerRef = useRef(null);
  const subscriptionContainerRef = useRef(null);
  const { steamUser, support, refresh } = useSteamSession();
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('');
  const [amount, setAmount] = useState('10.00');
  const [anchorSlug, setAnchorSlug] = useState('deep_blackhole');
  const [solarSystemKey, setSolarSystemKey] = useState('solar_system');
  const [donationSummary, setDonationSummary] = useState(null);
  const [checkoutMode, setCheckoutMode] = useState('donation');

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

  const availableMode = useMemo(() => {
    if (checkoutMode === 'subscription' && !config?.subscriptionEnabled) return 'donation';
    return checkoutMode;
  }, [checkoutMode, config]);

  useEffect(() => {
    const activeContainer = availableMode === 'subscription' ? subscriptionContainerRef.current : orderContainerRef.current;
    const inactiveContainer = availableMode === 'subscription' ? orderContainerRef.current : subscriptionContainerRef.current;
    if (inactiveContainer) inactiveContainer.innerHTML = '';

    if (!config?.configured || !config?.clientId || !activeContainer || !steamUser?.steamid) return;

    let cancelled = false;

    loadPayPalSdk({ clientId: config.clientId, currency: config.currency, mode: availableMode })
      .then(() => {
        if (cancelled || !window.paypal || !activeContainer) return;
        activeContainer.innerHTML = '';

        const buttonsConfig = availableMode === 'subscription'
          ? {
              style: { shape: 'rect', color: 'gold', layout: 'vertical', label: 'subscribe' },
              createSubscription: (data, actions) => actions.subscription.create({
                plan_id: config.subscriptionPlanId,
              }),
              onApprove: async (data) => {
                setStatus('Membership approved. Verifying and linking support...');
                const response = await fetch('/api/support/link', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    provider: 'paypal',
                    identifierType: 'subscription',
                    identifier: data.subscriptionID,
                    planId: config.subscriptionPlanId,
                  }),
                });
                const payload = await response.json().catch(() => null);
                if (!response.ok || !payload?.ok) {
                  setStatus(payload?.error || 'Subscription verification failed');
                  return;
                }
                setStatus('Membership linked to your Steam account.');
                refresh();
              },
              onCancel: () => setStatus('Subscription cancelled.'),
              onError: (error) => setStatus(error?.message || 'PayPal subscription error'),
            }
          : {
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
            };

        window.paypal.Buttons(buttonsConfig).render(activeContainer);
      })
      .catch((error) => setStatus(error.message || 'Unable to load PayPal'));

    return () => {
      cancelled = true;
      if (orderContainerRef.current) orderContainerRef.current.innerHTML = '';
      if (subscriptionContainerRef.current) subscriptionContainerRef.current.innerHTML = '';
    };
  }, [config, steamUser, amount, anchorSlug, solarSystemKey, refresh, availableMode]);

  if (!steamUser?.steamid) {
    return <LoginCallout currentPath="/donate" />;
  }

  return (
    <>
      <section className="content-card support-link-card">
        <p className="eyebrow">Protected Steam-bound support flow</p>
        <h3>Donate or subscribe through PayPal and bind support to your Steam-linked universe state</h3>
        <p className="muted">
          Orders and subscriptions are created against your Steam-linked session so support receipts can be matched to your pilot and current universe scope.
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

        <div className="support-mode-switcher">
          <button
            type="button"
            className={`support-mode-button ${availableMode === 'donation' ? 'active' : ''}`}
            onClick={() => setCheckoutMode('donation')}
          >
            One-time donation
          </button>
          <button
            type="button"
            className={`support-mode-button ${availableMode === 'subscription' ? 'active' : ''}`}
            onClick={() => setCheckoutMode('subscription')}
            disabled={!config?.subscriptionEnabled}
          >
            Monthly membership
          </button>
        </div>

        {availableMode === 'donation' ? (
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
        ) : (
          <div className="donate-note-box">
            <strong>Monthly membership</strong>
            <p>
              This subscription is created through PayPal and then verified against your Steam-linked pilot so your support status stays attached to your account.
            </p>
          </div>
        )}

        {status ? <p className="support-link-status">{status}</p> : null}
      </section>

      {config?.configured ? (
        <div className="paypal-live-shell">
          <div ref={orderContainerRef} style={{ display: availableMode === 'donation' ? 'block' : 'none' }} />
          <div ref={subscriptionContainerRef} style={{ display: availableMode === 'subscription' ? 'block' : 'none' }} />
        </div>
      ) : (
        <div className="content-card donate-note-box">
          <strong>PayPal configuration needed</strong>
          <p>Add your PayPal client ID, secret, and optional subscription plan ID in the environment before using the protected support flow.</p>
        </div>
      )}
    </>
  );
}
