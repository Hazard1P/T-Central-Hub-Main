"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSteamSession } from "@/components/SteamSessionProvider";
import ContributionHistory from "@/components/ContributionHistory";
import { SupportLinkIcon, SupportNoteIcon } from "@/components/SupportIcons";
import { loadPayPalSdk } from "@/lib/paypalSdk";
import { createRequestId } from '@/lib/requestId';
import {
  SUPPORT_FOCUS,
  moneyToMinor,
  currencyDigits,
} from "@/lib/accountPayments";
import { SUPPORT_RECEIPT_MAX_AGE_DAYS } from "@/lib/supportSessionConfig";

function LoginCallout({ currentPath = "/donate", config }) {
  return (
    <section
      className="donation-account-card"
      aria-labelledby="account-support-title"
    >
      <div className="donation-route-top">
        <span className="donation-route-label">Account-linked support</span>
        <span className="donation-route-icon" aria-hidden="true">
          <SupportLinkIcon />
        </span>
      </div>
      <h2 id="account-support-title">
        Keep your support
        <br />
        connected to you.
      </h2>
      <p>
        Sign in with Steam or Google to keep verified contributions in your
        private account history.
      </p>
      <ol className="donation-steps">
        <li>
          <span>1</span>Sign in
        </li>
        <li>
          <span>2</span>Choose an amount
        </li>
        <li>
          <span>3</span>Confirm with PayPal
        </li>
      </ol>
      <div className="donation-signin-actions">
        {config?.steam ? (
          <a
            className="button primary"
            href={`/api/auth/steam/login?redirectTo=${encodeURIComponent(currentPath)}`}
          >
            Continue with Steam
          </a>
        ) : null}
        {config?.google ? (
          <a
            className="button secondary"
            href={`/api/auth/google/login?redirectTo=${encodeURIComponent(currentPath)}`}
          >
            Continue with Google
          </a>
        ) : null}
      </div>
      {!config ? (
        <p className="donation-availability" role="status">
          Checking sign-in availability…
        </p>
      ) : !config.steam && !config.google ? (
        <p className="donation-availability">
          Account sign-in is currently unavailable. You can still use the direct
          PayPal option.
        </p>
      ) : null}
      <div className="donation-record-note">
        <SupportNoteIcon />
        <p>
          One account, a private record of your support. External receipts can
          be reviewed through <a href="/contact">our contact page</a>.
        </p>
      </div>
    </section>
  );
}

export default function DonateSupportClient() {
  const orderContainerRef = useRef(null);
  const subscriptionContainerRef = useRef(null);
  const { steamUser, googleUser, support, refresh, loading } = useSteamSession();
  const accountUser = steamUser || googleUser;
  const accountKey = steamUser?.steamid ? 'steam:' + steamUser.steamid : googleUser?.sub ? 'google:' + googleUser.sub : '';
  const requestId = useRef(null);
  const [focus, setFocus] = useState('general');
  const [historyRevision, setHistoryRevision] = useState(0);
  const [config, setConfig] = useState(null);
  const [authConfig, setAuthConfig] = useState(null);
  const [status, setStatus] = useState('');
  const [sdkRetry, setSdkRetry] = useState(0);
  const [sdkStatus, setSdkStatus] = useState('idle');
  const [amount, setAmount] = useState('10.00');

  const [checkoutMode, setCheckoutMode] = useState('donation');
  const [cancellingSubscription, setCancellingSubscription] = useState(false);

  let validAmount = false;
  try { validAmount = moneyToMinor(amount, config?.currency || 'USD') <= moneyToMinor('10000', config?.currency || 'USD'); } catch {}
  let amountStep = '0.01';
  try { if (currencyDigits(config?.currency || 'USD') === 0) amountStep = '1'; } catch {}

  useEffect(() => {
    fetch('/api/auth/config', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).then(setAuthConfig).catch(() => setAuthConfig({}));
    fetch('/api/donations/paypal/config', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setConfig(data?.ok ? data : { configured: false }))
      .catch(() => setConfig({ configured: false }));


  }, []);

  useEffect(() => { requestId.current = createRequestId(); }, [amount, focus, checkoutMode, steamUser?.steamid, googleUser?.sub]);

  const availableMode = useMemo(() => {
    if (checkoutMode === 'subscription' && (!config?.subscriptionEnabled || !steamUser)) return 'donation';
    return checkoutMode;
  }, [checkoutMode, config, steamUser]);

  const activeSubscriptionIdentifier = support?.subscriptionId || (support?.identifierType === 'subscription' ? support?.identifier : null);
  const supportStatus = String(support?.status || support?.verification?.state || '').toUpperCase();
  const canCancelSubscription = Boolean(
    activeSubscriptionIdentifier && support?.active !== false && !['CANCELLED', 'EXPIRED'].includes(supportStatus)
  );
  const linkedSupportReceipt = Boolean(support?.reference || support?.identifier);
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

    if (!config?.configured || !config?.clientId || !activeContainer || !accountKey || (availableMode === 'donation' && !validAmount)) { setSdkStatus('idle'); return; }

    let cancelled = false;
    let buttons;
    setSdkStatus('loading');

    loadPayPalSdk({ clientId: config.clientId, currency: availableMode === 'subscription' ? config.monthlyPlan.currency : config.currency, mode: availableMode })
      .then((sdk) => {
        if (cancelled || !activeContainer) return;
        activeContainer.innerHTML = '';

        const buttonsConfig = availableMode === 'subscription'
          ? {
              style: { shape: 'rect', color: 'gold', layout: 'vertical', label: 'subscribe' },
              createSubscription: async (data, actions) => {
                setStatus('Creating Steam-bound subscription...');
                const idempotencyKey = requestId.current;
                const response = await fetch('/api/donations/paypal/create-subscription', {
                  method: 'POST',
                  headers: {
                    'content-type': 'application/json',
                    'x-idempotency-key': idempotencyKey,
                  },
                  body: JSON.stringify({ planId: config.subscriptionPlanId, requestId: idempotencyKey }),
                });
                const payload = await response.json().catch(() => null);
                if (response.ok && payload?.subscriptionId) {
                  return payload.subscriptionId;
                }

                throw new Error(payload?.error || 'Unable to create your subscription. Please retry.');
              },
              onApprove: async (data) => {
                setStatus('Monthly support approved. Verifying your account link...');
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
                requestId.current = createRequestId();
                setHistoryRevision((value) => value + 1);
                setStatus('Monthly support linked to your Steam account. Payments appear in history once verified.');
                refresh();
              },
              onCancel: () => { requestId.current = createRequestId(); setStatus('Subscription checkout cancelled.'); },
              onError: (error) => setStatus(error?.message || 'PayPal subscription error'),
            }
          : {
              style: { shape: 'rect', color: 'gold', layout: 'vertical', label: 'donate' },
              createOrder: async () => {
                setStatus('Creating protected donation order...');
                const response = await fetch('/api/donations/paypal/create-order', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ amount, currency: config.currency, focus, requestId: requestId.current }),
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
                if (payload.pending || payload.capture?.status !== 'COMPLETED') { setStatus('Your payment is awaiting confirmation. Check your account history before making another contribution.'); return; }
                requestId.current = createRequestId();
                setHistoryRevision((value) => value + 1);
                setStatus(`Donation confirmed for ${payload?.capture?.amount || amount} ${payload?.capture?.currency || config.currency}.`);
                refresh();
              },
              onCancel: () => { requestId.current = createRequestId(); setStatus('Donation checkout cancelled.'); },
              onError: (error) => setStatus(error?.message || 'PayPal checkout error'),
            };

        const approve = buttonsConfig.onApprove;
        buttonsConfig.onApprove = async (...args) => {
          try { return await approve(...args); }
          catch {
            setStatus('Payment verification was interrupted. Refresh your account history before trying another contribution.');
            setHistoryRevision(value => value + 1);
          }
        };
        buttons = sdk.Buttons(buttonsConfig);
        return Promise.resolve(buttons.render(activeContainer)).then(() => { if (!cancelled) setSdkStatus('ready'); });
      })
      .catch((error) => { if (!cancelled) { setSdkStatus('error'); setStatus(error.message || 'Unable to load PayPal. Please retry.'); } });

    return () => {
      cancelled = true;
      try { Promise.resolve(buttons?.close?.()).catch(() => {}); } catch {}
      if (orderContainerRef.current) orderContainerRef.current.innerHTML = '';
      if (subscriptionContainerRef.current) subscriptionContainerRef.current.innerHTML = '';
    };
  }, [config, accountKey, amount, focus, refresh, availableMode, sdkRetry]);

  if (loading)
    return (
      <section
        className="donation-account-card donation-loading"
        aria-busy="true"
      >
        <p className="eyebrow">Account-linked support</p>
        <h2>Finding your account…</h2>
        <p role="status">Checking your sign-in and support options.</p>
      </section>
    );
  if (!accountUser) {
    return <LoginCallout currentPath="/donate" config={authConfig} />;
  }

  return (
    <>
      <section
        className="donation-account-card support-checkout"
        aria-labelledby="support-checkout-title"
      >
        <div className="donation-route-top">
          <span className="donation-route-label">Account-linked support</span>
          <span className="donation-route-icon" aria-hidden="true">
            <SupportLinkIcon />
          </span>
        </div>
        {config?.environment === "sandbox" ? (
          <p className="legal-draft-note">
            Sandbox checkout: test payments only. These do not count as live
            support or paid benefits.
          </p>
        ) : null}
        <h2 id="support-checkout-title">Choose your contribution</h2>
        <p className="donation-signed-in">
          Signed in as{" "}
          {accountUser.personaname || accountUser.name || "Community Pilot"}{" "}
          through {steamUser ? "Steam" : "Google"}. Your verified contributions
          stay with this account.
        </p>
        <div
          className="support-mode-switcher"
          aria-label="Contribution frequency"
        >
          <button
            type="button"
            className={`support-mode-button ${availableMode === "donation" ? "active" : ""}`}
            aria-pressed={availableMode === "donation"}
            onClick={() => setCheckoutMode("donation")}
          >
            Give once
          </button>
          <button
            type="button"
            className={`support-mode-button ${availableMode === "subscription" ? "active" : ""}`}
            aria-pressed={availableMode === "subscription"}
            onClick={() => setCheckoutMode("subscription")}
            disabled={!config?.subscriptionEnabled || !steamUser}
          >
            Monthly support
          </button>
        </div>
        {availableMode === "donation" ? (
          <>
            <div
              className="support-amounts"
              aria-label="Suggested contribution amounts"
            >
              {["5.00", "10.00", "25.00", "50.00"].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`button ${amount === value ? "primary" : "secondary"}`}
                  aria-label={`Select ${Number(value)} ${config?.currency || "USD"}`}
                  aria-pressed={amount === value}
                  onClick={() => setAmount(value)}
                >
                  <strong>{Number(value)}</strong>
                  <small>{config?.currency || "USD"}</small>
                </button>
              ))}
            </div>
            <div className="donation-checkout-fields">
              <label className="donation-field">
                <span>Your amount ({config?.currency || "USD"})</span>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  type="number"
                  min={amountStep}
                  max="10000"
                  step={amountStep}
                  aria-describedby="support-amount-help"
                />
              </label>
              <label className="donation-field">
                <span>Area you’d like to support</span>
                <select
                  value={focus}
                  onChange={(event) => setFocus(event.target.value)}
                >
                  {Object.entries(SUPPORT_FOCUS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="muted">
              Your chosen area is recorded as a preference. Contributions
              support the whole project.
            </p>
            <p className="muted" id="support-amount-help">
              Choose any amount from {amountStep} to 10,000. Review the currency
              and final total in PayPal before approving.
            </p>
            {!validAmount ? (
              <p role="alert">
                Enter a valid contribution amount before continuing.
              </p>
            ) : null}
          </>
        ) : (
          <div className="donate-note-box">
            <strong>
              {config.monthlyPlan.amount} {config.monthlyPlan.currency} per
              month
            </strong>
            <p>
              Renews monthly until cancelled. Cancel through PayPal or the
              account controls below. Review the full billing terms in PayPal
              before approval.
            </p>
          </div>
        )}
        {!config ? (
          <p className="muted">
            Checking account-linked checkout availability…
          </p>
        ) : !config.configured ? (
          <p className="muted">
            Account-linked checkout is currently unavailable. Please return
            later or contact support; no payment has been submitted.
          </p>
        ) : null}
        {!steamUser ? (
          <p className="muted">
            Monthly subscription management currently requires Steam. Your
            Google account can keep one-time contributions.
          </p>
        ) : null}
        {config && !config.subscriptionEnabled ? (
          <p className="muted">
            Monthly support is currently unavailable. One-time support remains
            an option.
          </p>
        ) : null}
        {config?.configured ? (
          <div className="paypal-live-shell">
            <div
              ref={orderContainerRef}
              hidden={availableMode !== "donation" || !validAmount}
            />
            <div
              ref={subscriptionContainerRef}
              hidden={availableMode !== "subscription"}
            />
          </div>
        ) : null}
        {config?.configured && sdkStatus === "loading" ? (
          <p role="status">Loading secure PayPal checkout…</p>
        ) : null}
        {config?.configured && sdkStatus === "error" ? (
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setStatus("");
              setSdkRetry((value) => value + 1);
            }}
          >
            Retry PayPal checkout
          </button>
        ) : null}
        {status ? (
          <p className="support-link-status" role="status">
            {status}
          </p>
        ) : null}
        <details className="support-account-details">
          <summary>Receipts and subscription management</summary>
          <p>
            Payment history is stored against your verified account and remains
            available across devices.
          </p>
          <p>
            {linkedSupportReceipt
              ? `A verified support receipt is linked to this ${steamUser ? "Steam" : "Google"} account.`
              : "No verified receipt is linked yet."}
          </p>
          {paypalReference ? (
            <p className="directory-address">Reference: {paypalReference}</p>
          ) : null}
          <p className="muted">
            Verified receipt cookies remain on this device for up to{" "}
            {SUPPORT_RECEIPT_MAX_AGE_DAYS} days. Account-linked server records
            may be retained separately.
          </p>
          {activeSubscriptionIdentifier ? (
            <p className="directory-address">
              Subscription: {activeSubscriptionIdentifier}
            </p>
          ) : null}
          <button
            type="button"
            className="button secondary"
            disabled={!canCancelSubscription || cancellingSubscription}
            onClick={cancelSubscription}
          >
            {cancellingSubscription
              ? "Cancelling…"
              : "Cancel PayPal subscription"}
          </button>
          <p className="muted">
            Cancellation stops future billing once confirmed. For completed
            contributions, <a href="/contact">request billing or refund help</a>
            . Stopping play or clearing browser storage does not cancel
            recurring billing.
          </p>
        </details>
        <details className="donation-history">
          <summary>
            Your contribution history <span>Private account records</span>
          </summary>
          <ContributionHistory
            key={`${steamUser ? "steam:" + steamUser.steamid : "google:" + googleUser.sub}:${historyRevision}`}
          />
        </details>
      </section>
    </>
  );
}
