'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSteamSession } from '@/components/SteamSessionProvider';
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

function LoginCallout({ currentPath = '/donate' }) {
  return (
    <div className="content-card donate-note-box">
      <strong>Want an account-linked receipt?</strong>
      <p>Sign in with Steam for an account-linked contribution. You can also use the direct PayPal.Me option below, including when you use Google to sign in.</p>
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
  const anchorSlug = 'deep_blackhole';
  const solarSystemKey = 'solar_system';
  const [donationSummary, setDonationSummary] = useState(null);
  const [checkoutMode, setCheckoutMode] = useState('donation');
  const [cancellingSubscription, setCancellingSubscription] = useState(false);

  useEffect(() => {
    fetch('/api/donations/paypal/config', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setConfig(data?.ok ? data : { configured: false }))
      .catch(() => setConfig({ configured: false }));

    fetch('/api/donations/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setDonationSummary(data?.summary || null))
      .catch(() => setDonationSummary(null));
  }, []);

  const availableMode = useMemo(() => {
    if (checkoutMode === 'subscription' && !config?.subscriptionEnabled) return 'donation';
    return checkoutMode;
  }, [checkoutMode, config]);

  const activeSubscriptionIdentifier = support?.subscriptionId || (support?.identifierType === 'subscription' ? support?.identifier : null);
  const supportStatus = String(support?.status || support?.verification?.state || '').toUpperCase();
  const canCancelSubscription = Boolean(
    activeSubscriptionIdentifier && support?.active !== false && !['CANCELLED', 'EXPIRED'].includes(supportStatus)
  );
  const linkedSupportReceipt = Boolean(support?.reference || support?.identifier);
  const latestDonation = donationSummary?.latest || null;
  const confirmedDonationText = donationSummary?.confirmed
    ? `${donationSummary.confirmed} confirmed / ${donationSummary.totalAmount} ${config?.currency || latestDonation?.currency || 'USD'}`
    : 'No confirmed one-time donation yet';
  const paypalReference = support?.reference || support?.verification?.identifier || support?.identifier || null;

  const cancelSubscription = async () => {
    if (!activeSubscriptionIdentifier || cancellingSubscription) return;

    setCancellingSubscription(true);
    setStatus('Cancelling PayPal subscription through T-Central.me account management...');

    try {
      const response = await fetch('/api/support/cancel-subscription', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: 'paypal',
          subscriptionId: activeSubscriptionIdentifier,
          reason: 'T-Central.me account-management cancellation',
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        setStatus(payload?.error || 'Subscription cancellation failed');
        return;
      }

      setStatus(
        payload.alreadyCancelled
          ? 'Subscription was already cancelled in PayPal. Support status updated.'
          : 'Subscription cancellation sent to PayPal. Future recurring billing is stopped once PayPal confirms it.'
      );
      refresh();
    } catch (error) {
      setStatus(error?.message || 'Subscription cancellation failed');
    } finally {
      setCancellingSubscription(false);
    }
  };

  useEffect(() => {
    const activeContainer = availableMode === 'subscription' ? subscriptionContainerRef.current : orderContainerRef.current;
    const inactiveContainer = availableMode === 'subscription' ? orderContainerRef.current : subscriptionContainerRef.current;
    if (inactiveContainer) inactiveContainer.innerHTML = '';

    if (!config?.configured || !config?.clientId || !activeContainer || !steamUser?.steamid) return;

    let cancelled = false;

    loadPayPalSdk({ clientId: config.clientId, currency: availableMode === 'subscription' ? config.monthlyPlan.currency : config.currency, mode: availableMode })
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

                throw new Error(payload?.error || 'Unable to create your subscription. Please retry.');
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

  const validAmount = Number.isFinite(Number(amount)) && Number(amount) >= .01 && Number(amount) <= 10000;
  return (
    <section className="content-card support-checkout" aria-labelledby="support-checkout-title">
      <p className="eyebrow">Account-linked support</p><h2 id="support-checkout-title">Choose how you’d like to help</h2>
      <p>Signed in as {steamUser.personaname || 'Steam Pilot'}. Contributions support the whole project; suggested amounts are not purchases of a specific item.</p>
      <div className="support-mode-switcher" aria-label="Contribution frequency">
        <button type="button" className={`support-mode-button ${availableMode === 'donation' ? 'active' : ''}`} aria-pressed={availableMode === 'donation'} onClick={() => setCheckoutMode('donation')}>One-time contribution</button>
        <button type="button" className={`support-mode-button ${availableMode === 'subscription' ? 'active' : ''}`} aria-pressed={availableMode === 'subscription'} onClick={() => setCheckoutMode('subscription')} disabled={!config?.subscriptionEnabled}>Monthly support</button>
      </div>
      {availableMode === 'donation' ? <>
        <div className="support-amounts" aria-label="Suggested contribution amounts">{['5.00', '15.00', '30.00'].map((value) => <button key={value} type="button" className={`button ${amount === value ? 'primary' : 'secondary'}`} aria-pressed={amount === value} onClick={() => setAmount(value)}>{Number(value)} {config?.currency || 'USD'}</button>)}</div>
        <label className="donation-field"><span>Your amount ({config?.currency || 'USD'})</span><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" type="number" min="0.01" max="10000" step="0.01" aria-describedby="support-amount-help" /></label>
        <p className="muted" id="support-amount-help">Choose any amount from 0.01 to 10,000. Review the currency and final total in PayPal before approving.</p>
        {!validAmount ? <p role="alert">Enter a valid contribution amount before continuing.</p> : null}
      </> : <div className="donate-note-box"><strong>{config.monthlyPlan.amount} {config.monthlyPlan.currency} per month</strong><p>Renews monthly until cancelled. Cancel through PayPal or the account controls below. Review the full billing terms in PayPal before approval.</p></div>}
      {!config ? <p className="muted">Checking account-linked checkout availability…</p> : !config.configured ? <p className="muted">Account-linked checkout is currently unavailable. You can still make a one-time contribution through PayPal.Me below.</p> : null}
      {config && !config.subscriptionEnabled ? <p className="muted">Monthly support is currently unavailable. One-time support remains an option.</p> : null}
      {config?.configured ? <div className="paypal-live-shell">
        <div ref={orderContainerRef} hidden={availableMode !== 'donation' || !validAmount} />
        <div ref={subscriptionContainerRef} hidden={availableMode !== 'subscription'} />
      </div> : null}
      {status ? <p className="support-link-status" role="status">{status}</p> : null}
      <details className="support-account-details"><summary>Receipts and subscription management</summary>
        <p>{confirmedDonationText}</p><p>{linkedSupportReceipt ? 'A verified support receipt is linked to this Steam account.' : 'No verified receipt is linked yet.'}</p>
        {paypalReference ? <p className="directory-address">Reference: {paypalReference}</p> : null}
        <p className="muted">Verified receipt cookies remain on this device for up to {SUPPORT_RECEIPT_MAX_AGE_DAYS} days. Account-linked server records may be retained separately.</p>
        {activeSubscriptionIdentifier ? <p className="directory-address">Subscription: {activeSubscriptionIdentifier}</p> : null}
        <button type="button" className="button secondary" disabled={!canCancelSubscription || cancellingSubscription} onClick={cancelSubscription}>{cancellingSubscription ? 'Cancelling…' : 'Cancel PayPal subscription'}</button>
        <p className="muted">Cancellation stops future billing once confirmed. For completed contributions, <a href="/contact">request billing or refund help</a>. Stopping play or clearing browser storage does not cancel recurring billing.</p>
      </details>
    </section>
  );
}
