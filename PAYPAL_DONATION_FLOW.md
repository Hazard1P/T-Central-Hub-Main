# PayPal project support

The direct project link is **https://paypal.me/TCentralG**. `/donate` offers this as an external, voluntary support option. External gifts do not automatically sync to an account; receipt review is available through `/contact`. Check the recipient and total on PayPal before approving.

For automatic private account history, sign in with Steam or Google and use the embedded one-time checkout. Monthly support management currently requires Steam and a verified recurring plan. The server saves the account/amount snapshot before creating an order, verifies the capture, and records payments and adjustments in the account ledger. Approvals alone never count as paid support.

See [ACCOUNT-PAYMENTS.md](docs/ACCOUNT-PAYMENTS.md) for the authoritative setup, migrations, privacy, webhooks, refunds, reconciliation and verification procedure. Set the canonical `APP_URL` or `NEXT_PUBLIC_APP_URL`, stable `SESSION_SECRET`, Supabase URL/service key, PayPal client ID/secret, matching sandbox/live environment, currency and webhook ID. Subscription plan ID is optional.

Local fixture checks are not proof of live settlement. Validate real sandbox callbacks, captures, duplicate events, refunds, recurring charges and cancellation before enabling live credentials. VIP sales remain unavailable; contributions buy no redeemable credits, ship upgrades or guaranteed future benefit.
