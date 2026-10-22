# Account-bound contributions and future VIP records

This update records verified project support against the Steam or Google identity used at checkout. It does not publish a VIP product. The operator explicitly requested that VIP plans remain undefined.

## Authority and account binding

- `account_payment_intents` holds the immutable provider/account identity, request key, price, currency, purchase type, intended support focus and product/terms snapshot. The intent is saved before PayPal is called. One-time orders use an opaque `tc:<intent UUID>` binding at PayPal rather than exposing the account identifier in checkout metadata.
- Server-verified cookies determine the owner. Client-supplied account IDs and providers are not accepted as ownership claims. Steam and Google IDs occupy separate namespaces, even when their strings or email addresses match.
- Account-linked one-time checkout supports Steam and Google. Existing subscription management remains Steam-bound. A subscription approval or active status is not counted as money received.
- The server loads the owned intent and verifies the provider order, custom binding, amount and currency before making a capture request. Both provider request IDs and durable transaction keys make retries safe.
- Browser financial views use the current session; they do not restore an unrelated account’s cached receipt after logout or account switching. Account history comes from the database, not the old browser donation cookie.

## Financial records and analytics

`account_payment_charges` records verified captures or recurring sale receipts. Unique transaction IDs prevent duplicate callbacks, different webhook event IDs and worker restarts from adding the same payment again. `account_payment_adjustments` records refunds and reversals with independent unique provider references. RPCs lock the relevant intent/charge so the recorded adjustments cannot exceed the charge. A full reversal after a partial refund removes the remaining amount instead of subtracting the original amount twice.

Sandbox and live records are scoped separately and visibly labelled; sandbox captures never create paid VIP benefit rows. Legacy records start with an unknown environment, so they are excluded from current live totals until verified against the intended provider environment. Use separate sandbox and production databases where practical.

Amounts use exact integer payment units and currency-specific precision. Totals are grouped by currency and purchase type; CAD and USD are never added into an unlabeled total. The private summary aggregates all recorded payments while displaying the latest 50. Support-focus values are preferences for development, marketing, hardware or the whole project, not expenditure reports or binding allocation percentages.

The account profile and donation page show private totals, receipts, refund amounts and the future-recognition notice. Refreshing can pick up signed webhook updates. The JSON download contains the displayed recent records and full aggregate totals; it is not an unlimited historical export. Users can request additional records through the privacy/support process.

`/admin/support` provides restricted operator reporting and optional provider/account filtering. Access requires **both** `PAYMENTS_ADMIN_PROVIDER` (`steam` or `google`) and `PAYMENTS_ADMIN_ACCOUNT_ID` to match the verified session. It is separate from the older Dyson administrator setting. The default report contains aggregate funding data without public account lists. Financial analytics remain private database/application records; account IDs, payment histories and payer details are not sent as third-party advertising or Vercel analytics properties by this feature.

## Webhooks and reconciliation

Enable and verify the PayPal webhook using the real `PAYPAL_WEBHOOK_ID`. Financial events include:

- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.REFUNDED` and `PAYMENT.CAPTURE.REVERSED`
- `PAYMENT.SALE.COMPLETED` for recurring subscription receipts
- `PAYMENT.SALE.REFUNDED` and `PAYMENT.SALE.REVERSED`

The signature is verified before reconciliation. Capture completion is checked against provider order details. Refund relationships resolve to known transactions; user email or browser assertions never assign ownership. Recurring receipts resolve through the recorded subscription binding. Existing Steam subscriptions can be linked through a trusted server ledger and verified provider subscription metadata before their newly received payments are recorded.

Signed-in checkout automatically records verified contributions. The donation page also offers the existing `https://paypal.me/TCentralG` direct link. External gifts do not automatically sync to an account; contributors can request receipt review. Never infer an account from a payer email or grant future benefits from an unverified external receipt.

Unknown financial events are retained as unmatched for operator review. PayPal.Me gifts cannot automatically be assigned by payer email or claimed receipt text. Reconciliation/storage failures return a retryable error instead of acknowledging an unrecorded payment as successful. Durable monetary records are reconciled before the legacy in-memory compatibility cache is consulted.

Historical import preserves owned legacy one-time checkout intents and copies only captures previously recorded as completed. Pending approvals do not become paid records. Existing records with unsupported currencies need manual review. Historical subscription statuses do not reconstruct older monetary transactions; reconcile prior recurring payments and refunds against PayPal before treating an imported history as a complete accounting ledger.

## Future VIP support

The schema separates `donation`, `support_subscription` and `vip_purchase`. Current public checkout rejects attempts to label a contribution as a VIP purchase. No price, duration, benefit, discount, priority access, conversion of past donations, or future entitlement has been invented.

When a real VIP offer is defined and reviewed, the server-controlled offer must provide its immutable price and benefit/terms snapshot before sale. The schema can create account-associated benefit records in `pending` status for verified VIP payments. Refunds or reversals revoke those records conservatively for review. A future fulfillment mechanism must use these explicit records, not an active subscription flag, a cookie or unverified historical support. Ordinary donations have no benefit rows and no cash redemption.

## Deployment

1. Apply `20261021_account_payment_history.sql` after the existing donations and support-ledger migrations. It adds private tables, constraints, immutable-history triggers and service-role-only RPCs. It is rerunnable for the same schema version. Browser roles cannot read or mutate the financial tables or call the reporting RPCs directly.
2. Configure the existing production Supabase URL and server-only service-role key. Keep `SESSION_SECRET` stable and private. Account history and checkout preparation fail closed when durable storage is unavailable.
3. Configure real PayPal credentials, the intended environment/currency, webhook ID and optional monthly plan. The monthly-plan verifier must accept the actual fixed-price plan before it is offered.
4. Configure the exact payment administrator identity if operator reporting is required. Review the imported history and unmatched events.
5. Validate with actual PayPal sandbox credentials: a payment on each supported account provider, callbacks/webhooks, a duplicate event, a refund, a renewal and cancellation. Then separately verify production settings before enabling live checkout. Preserve mandatory consumer and privacy rights and the legal review process.

Local verification uses PostgreSQL via PGlite, controlled PostgREST/PayPal fixtures and encrypted test sessions. No real charge is made. Fixture-only endpoints, credentials and process preload files live outside the repository and must never be deployed. Real provider settlement and the deployed database remain unverified until the production prerequisites are configured.

## Repeatable database verification

`scripts/verify-account-payments-db.mjs` runs the financial migration and authorization checks against an isolated in-memory PostgreSQL database. It requires optional `@electric-sql/pglite` tooling (verified with version 0.5.10), not a production dependency. Install it in a separate tooling directory and supply the absolute path to its `dist/index.js` using `PGLITE_MODULE_PATH`, then run `node scripts/verify-account-payments-db.mjs`. No application database or payment credentials are used.

The checks cover rerunnable imports, provider isolation, immutable ownership/history, exact totals beyond the displayed receipt limit, replay protection, refunds and reversals, sandbox separation, future benefit snapshots and denial of browser database roles.

## Checkout usability

The public config endpoint only offers embedded checkout when credentials, webhook ID, stable production session secret, supported currency and a reachable payment-intent table are available. It returns no private settings or records. Monthly support is offered only after verifying the actual plan. The SDK loader shares pending loads across amount changes, isolates capture/subscription SDK namespaces, bounds load time and supports retry; buttons are closed on cleanup. No live PayPal settlement is implied by local fixture tests.
