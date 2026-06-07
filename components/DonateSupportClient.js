'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSteamSession } from '@/components/SteamSessionProvider';
import { getDonationRouteOptions } from '@/lib/donationRouteOptions';
import { SUPPORT_RECEIPT_MAX_AGE_DAYS } from '@/lib/supportSessionConfig';

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

const legalLinks = [
  { href: '/terms-and-conditions', label: 'Terms' },
  { href: '/privacy-policy', label: 'Privacy' },
  { href: '/eula', label: 'EULA' },
  { href: '/multiplayer-policy', label: 'Multiplayer Policy' },
  { href: '/contact', label: 'Contact' },
];

function PaymentLegalDisclosure() {
  return (
    <aside className="donate-legal-disclosure" aria-label="Payment legal disclosure">
      <strong>Payment disclosure</strong>
      <p>
        One-time donations and recurring subscriptions are processed by PayPal. Monthly memberships recur until cancelled
        through PayPal or the account-management path provided. Donations/support do not guarantee in-game currency,
        stored value, external payout, or real-world return. PayPal.Me fallback may not automatically bind to the
        Steam-linked account. Refund/support questions should use <a href="/contact">contact</a>.
      </p>
      <nav className="donate-legal-links" aria-label="Donation legal links">
        {legalLinks.map((link) => (
          <a key={link.href} href={link.href}>{link.label}</a>
        ))}
      </nav>
    </aside>
  );
}

const supportPackages = [
  {
    id: 'one-time-support',
    name: 'One-time support',
    eyebrow: 'Single gift',
    mode: 'donation',
    amount: '10.00',
    anchorSlug: 'deep_blackhole',
    solarSystemKey: 'solar_system',
    description: 'Send a Steam-linked one-time donation through the protected PayPal order flow.',
    details: ['Sets a $10.00 default', 'Deep Blackhole anchor', 'Primary Solar System path'],
  },
  {
    id: 'monthly-supporter',
    name: 'Monthly supporter',
    eyebrow: 'Recurring',
    mode: 'subscription',
    description: 'Start the configured PayPal subscription plan and link the verified membership to this Steam account.',
    details: ['Uses configured PayPal plan', 'Verifies via /api/support/link', 'Best for steady server support'],
  },
  {
    id: 'core-patron',
    name: 'Patron / core supporter',
    eyebrow: 'Core backing',
    mode: 'subscription',
    description: 'Choose the patron-style lane for core supporters while keeping the same account-linked subscription verification.',
    details: ['Account-linked support receipt', 'Active subscription tracking', 'Built for long-term backers'],
  },
];

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
  const [selectedPackageId, setSelectedPackageId] = useState(supportPackages[0].id);
  const { blackholeAnchors, solarSystems } = useMemo(() => getDonationRouteOptions(), []);

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

  const selectedPackage = useMemo(
    () => supportPackages.find((supportPackage) => supportPackage.id === selectedPackageId) || supportPackages[0],
    [selectedPackageId]
  );

  const availableMode = useMemo(() => {
    if (checkoutMode === 'subscription' && !config?.subscriptionEnabled) return 'donation';
    return checkoutMode;
  }, [checkoutMode, config]);

  const activeSubscriptionIdentifier = support?.subscriptionId || (support?.identifierType === 'subscription' ? support?.identifier : null);
  const linkedSupportReceipt = Boolean(support?.reference || support?.identifier);
  const latestDonation = donationSummary?.latest || null;
  const confirmedDonationText = donationSummary?.confirmed
    ? `${donationSummary.confirmed} confirmed / ${donationSummary.totalAmount} ${config?.currency || latestDonation?.currency || 'USD'}`
    : 'No confirmed one-time donation yet';
  const paypalReference = support?.reference || support?.verification?.identifier || support?.identifier || null;

  const selectSupportPackage = (supportPackage) => {
    setSelectedPackageId(supportPackage.id);
    setCheckoutMode(supportPackage.mode);

    if (supportPackage.mode === 'donation') {
      setAmount(supportPackage.amount);
      setAnchorSlug(supportPackage.anchorSlug);
      setSolarSystemKey(supportPackage.solarSystemKey);
    }
  };

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
              createSubscription: async (data, actions) => {
                setStatus('Creating Steam-bound subscription...');
                const idempotencyKey = `subscription:${steamUser.steamid}:${Date.now()}`;
                const response = await fetch('/api/donations/paypal/create-subscription', {
                  method: 'POST',
                  headers: {
                    'content-type': 'application/json',
                    'x-idempotency-key': idempotencyKey,
                  },
                  body: JSON.stringify({ planId: config.subscriptionPlanId, idempotencyKey }),
                });
                const payload = await response.json().catch(() => null);
                if (response.ok && payload?.subscriptionId) {
                  return payload.subscriptionId;
                }

                if (!actions?.subscription?.create) {
                  throw new Error(payload?.error || 'Unable to create Steam-bound subscription');
                }

                return actions.subscription.create({
                  plan_id: config.subscriptionPlanId,
                  custom_id: String(steamUser.steamid),
                });
              },
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
                setDonationSummary(payload?.summary || payload?.cacheSummary || null);
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
            <span className="support-link-label">Linked support receipt</span>
            <strong>{linkedSupportReceipt ? 'Linked to this Steam account' : 'No receipt linked'}</strong>
            <small>{support?.linkedAt ? `Linked ${new Date(support.linkedAt).toLocaleString()}` : 'Complete PayPal checkout to attach a receipt'}</small>
          </div>

          <div className="support-link-panel">
            <span className="support-link-label">Active subscription identifier</span>
            <strong>{activeSubscriptionIdentifier ? 'Subscription active' : 'No subscription identifier'}</strong>
            <small>{activeSubscriptionIdentifier || 'Choose a monthly package to create one'}</small>
          </div>

          <div className="support-link-panel">
            <span className="support-link-label">Confirmed one-time donation</span>
            <strong>{donationSummary?.confirmed ?? 0} confirmed</strong>
            <small>{confirmedDonationText}</small>
          </div>

          <div className="support-link-panel">
            <span className="support-link-label">PayPal reference</span>
            <strong>{paypalReference ? 'Reference available' : 'No PayPal reference yet'}</strong>
            <small>{paypalReference || 'PayPal order, capture, or subscription reference will appear after checkout'}</small>
          </div>
        </div>

        <p className="support-link-status">
          Linked support receipts remain available on this device for {SUPPORT_RECEIPT_MAX_AGE_DAYS} days after verification.
        </p>

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
                {blackholeAnchors.map((anchor) => (
                  <option key={anchor.anchorSlug} value={anchor.anchorSlug}>
                    {anchor.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="donation-field">
              <span>Solar system</span>
              <select value={solarSystemKey} onChange={(event) => setSolarSystemKey(event.target.value)}>
                {solarSystems.map((system) => (
                  <option key={system.solarSystemKey} value={system.solarSystemKey}>
                    {system.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div className="donate-note-box">
            <strong>{selectedPackage.name}</strong>
            <p>
              This subscription uses the configured PayPal plan ID ({config?.subscriptionPlanId || 'not configured yet'}) and is then verified against your Steam-linked pilot so your support status stays attached to your account.
            </p>
          </div>
        )}

        {status ? <p className="support-link-status">{status}</p> : null}
      </section>

      {config?.configured ? (
        <div className="paypal-live-shell">
          <div ref={orderContainerRef} style={{ display: availableMode === 'donation' ? 'block' : 'none' }} />
          <div ref={subscriptionContainerRef} style={{ display: availableMode === 'subscription' ? 'block' : 'none' }} />
          <PaymentLegalDisclosure />
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
