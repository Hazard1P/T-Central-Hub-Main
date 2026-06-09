# PayPal + Steam Protected Donation Flow

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

- `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_ENV` (`sandbox` or `live`)
- `PAYPAL_CURRENCY` (defaults to `USD`)
- `PAYPAL_SUBSCRIPTION_PLAN_ID` (required only for subscription purchases)
- `PAYPAL_WEBHOOK_ID` (required for webhook signature verification)

## Cancellation handling

- Active recurring PayPal memberships can be cancelled from the protected donation page after Steam login.
- The client posts the linked PayPal subscription ID to `/api/support/cancel-subscription`.
- The route verifies the Steam session, checks the latest support ledger or signed support receipt, confirms the PayPal subscription belongs to that Steam ID when PayPal metadata is available, and calls PayPal's `/v1/billing/subscriptions/{subscription_id}/cancel` endpoint.
- After a successful cancellation request, T-Central stores a cancelled support receipt and support-ledger status so the account no longer appears as an active subscription while waiting for any PayPal webhook reconciliation.
- In-progress one-time donations can be cancelled from the PayPal checkout approval screen. Completed one-time donations cannot be cancelled as recurring billing; refund, dispute, or support requests should go through PayPal or `/contact`.
