# Vercel deployment notes

## Required environment variables
- `NEXT_PUBLIC_APP_URL`
- `SESSION_SECRET`
- `STEAM_API_KEY` if you want enriched Steam profiles
- `DYSON_ADMIN_ACCOUNT_ID` for the single account allowed to use admin-only Dyson operations

## Optional environment variables
- `SUPPORT_LINK_SECRET`
- `STATUS_SOURCE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_MULTIPLAYER_ROOM`
- `NEXT_PUBLIC_MULTIPLAYER_MAX_SLOTS`
- `NEXT_PUBLIC_WORLD_RINGS`
- `NEXT_PUBLIC_WORLD_RING_DENSITY`
- `DYSON_ADMIN_PROVIDER` to restrict the admin account check to one auth provider, such as `steam` or `google`

## Recommended Vercel project settings
- Framework preset: Next.js
- Node version: **24.x** (default) or **22.x/20.x** when needed (matches `package.json` engines: `20.x || 22.x || 24.x`)
- Build command: `npm run build`
- Output directory: leave empty for Next.js auto-detection

## Runtime compatibility note
- This repo uses Next.js `14.2.35`, which requires Node.js `>=18.17`.
- For parity across local CI and Vercel, this repository supports LTS lines `20.x`, `22.x`, and `24.x`.
- Canonical runtime target for production remains Node `24.x` (default on Vercel), with `22.x` and `20.x` as supported fallback LTS options.

## Post-deploy checks
- `/api/health`
- `/api/auth/steam/login`
- `/api/live-status`
- `/system`


## PayPal donation flow

Add these environment variables in Vercel:
- `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_ENV`
- `PAYPAL_CURRENCY`

Recommended webhook target:
- `/api/donations/paypal/webhook`

Before enabling live PayPal donations, complete this webhook checklist:
- [ ] Register `https://<production-domain>/api/donations/paypal/webhook` in the PayPal app dashboard.
- [ ] Subscribe to these webhook events handled by `app/api/donations/paypal/webhook/route.js`:
  - `CHECKOUT.ORDER.APPROVED`
  - `PAYMENT.CAPTURE.COMPLETED`
  - `BILLING.SUBSCRIPTION.CREATED`
  - `BILLING.SUBSCRIPTION.ACTIVATED`
  - `BILLING.SUBSCRIPTION.UPDATED`
  - `BILLING.SUBSCRIPTION.SUSPENDED`
  - `BILLING.SUBSCRIPTION.CANCELLED`
  - `BILLING.SUBSCRIPTION.EXPIRED`
  - `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
- [ ] Copy the dashboard webhook ID into `PAYPAL_WEBHOOK_ID`.
- [ ] Confirm webhook verification succeeds before switching `PAYPAL_ENV` to `live`.
