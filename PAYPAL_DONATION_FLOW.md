# PayPal + Steam Protected Donation Flow

Protected PayPal checkout requires a valid Steam session so each protected donation or subscription can be bound to an authenticated Steam ID. Supporters who do not want to bind a Steam account can still use the direct PayPal.Me fallback, but that fallback is not part of the protected Steam-linked checkout flow.

1. User signs in with Steam.
2. Client requests `/api/donations/paypal/config`.
3. PayPal button requests `/api/donations/paypal/create-order`.
4. Server creates the order with the authenticated Steam ID bound into internal metadata.
5. After approval, the client calls `/api/donations/paypal/capture-order`.
6. Server captures the order and stores a signed support receipt.
7. PayPal sends server-to-server webhook events to `/api/donations/paypal/webhook`.
8. Webhook route verifies signatures using the raw body and PayPal verification API.
9. Verified webhook events reconcile donation/support records keyed by `orderId`, `captureId`, or `subscriptionId`.
10. Idempotency is enforced by recording processed webhook event IDs and skipping duplicates.

## Supported PayPal webhook events

- `CHECKOUT.ORDER.APPROVED`
- `PAYMENT.CAPTURE.COMPLETED`
- `BILLING.SUBSCRIPTION.CREATED`
- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.UPDATED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.EXPIRED`
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED`

Other event types are accepted, signature-verified, marked processed, and ignored.

## Required environment variables

- `NEXT_PUBLIC_APP_URL` — must be set to the production origin, for example `https://example.com`, so Steam OpenID returns to the deployed site and session cookies are issued for the correct host.
- `SESSION_SECRET` — must be set to a stable, high-entropy value in production. Rotating or omitting it invalidates encrypted Steam sessions and prevents protected checkout from reliably recognizing returning authenticated users.
- `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_ENV` (`sandbox` or `live`)
- `PAYPAL_CURRENCY` (defaults to `USD`)
- `PAYPAL_SUBSCRIPTION_PLAN_ID` (required only for subscription purchases)
- `PAYPAL_WEBHOOK_ID` (required for webhook signature verification)

## Recommended environment variables

- `STEAM_API_KEY` — optional for the Steam sign-in itself because the protected checkout can bind a session with the returned Steam ID, but recommended so the app can enrich the session with Steam profile data such as persona name, profile URL, and avatar.

## Production validation

After deploying the production environment variables, open `/api/auth/steam/login?redirectTo=/donate` on the production origin and complete Steam sign-in. A successful protected checkout setup redirects back to `/donate?steam=linked`, which confirms the Steam session cookie was created for the deployed donation page.

If the redirect does not return to `/donate?steam=linked`, re-check that `NEXT_PUBLIC_APP_URL` exactly matches the production origin and that `SESSION_SECRET` is stable across deployments.

## PayPal.Me fallback

PayPal.Me remains available without Steam binding for supporters who prefer a direct one-time contribution or do not want to authenticate with Steam. Because PayPal.Me bypasses the protected server-created order flow, it may not automatically attach the contribution to a Steam-linked support record.
