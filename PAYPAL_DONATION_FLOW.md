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
