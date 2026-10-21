# Community, server discovery and ongoing support

The community board uses server-verified Steam or Google sessions. A post has a heading (`topic`, 120 characters), optional subheading (180), category and message (3,000). The API returns a public author allowlist, never the stored author authentication profile. References use UUIDs so simultaneous posts do not collide.

The board reloads every 15 seconds while visible, when focus returns, on manual refresh, and after publishing. A BroadcastChannel notifies other tabs in the same browser profile. It uses uncached reads, rejects older overlapping responses, preserves loaded posts during errors, and keeps a failed submission’s draft. Category and text filters apply to the latest 40 published community posts. This is polling, not a WebSocket or a complete forum with replies/editing.

Production requires `NEXT_PUBLIC_SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY`, the original `20260608_hub_posts.sql` migration and `20261019_community_post_headings.sql`. The latter adds the subheading constraint, enables RLS and revokes direct browser-role access to full author records. Writes and reads use the server service role. Apply migrations to the intended database before publishing this application update. A missing or failing production store returns an unavailable response; the app does not pretend an empty feed proves successful synchronization. Do not configure a service-role key as a NEXT_PUBLIC variable.

Local development may use the existing JSON adapter. Writes are queued and atomically renamed. Tests can set `TCENTRAL_LOCAL_DATA_DIR` to an isolated directory in development; production ignores this override. Local persistence is not a substitute for hosted multi-instance storage.

## Independent server browser

T-Central does not currently operate active Rust or Arma 3 servers. Legacy bookmarks and universe route identifiers remain stable, but their pages now open third-party discovery. Old owned-server addresses, fabricated capacity claims and playable-avatar bridge claims are not advertised as active.

`GET /api/server-directory?game=rust` (or `arma3`) fetches BattleMetrics rankings with online/player filters, validates response fields, sorts by rank and displays up to 12 populated servers. The API coalesces requests and caches a successful result for one minute; the browser refreshes every minute while visible. Results show their check time. A failed refresh labels saved results as previously observed; a failed initial request shows direct ranking links without fabricated server cards. Server operators retain their own rules, wipe schedules and moderation.

Allow HTTPS to `api.battlemetrics.com` in the hosting environment. This cloud workspace denied that destination during validation. A network domain addition was saved in the cloud environment configuration draft; it does not take effect until the environment settings are reviewed, saved and published. Real upstream ranking responses remain unverified in this workspace. Controlled provider fixtures test parsing, game filtering, ranking, selection and connection links without claiming to be live third-party servers. If BattleMetrics changes public API access or response formats, verify against its current documentation and adjust the adapter rather than substituting invented data.

## Support page

The page explains the operator-confirmed funding purposes: ongoing development, marketing, hardware and project infrastructure. Suggested amounts are voluntary contributions to the project as a whole. No percentage allocation, hardware purchase, exclusive perk, delivery date, cash redemption, tax deduction or competitive advantage is promised. Feedback and browser play remain available without contributing.

New contributions now use signed-in account checkout. The donation page routes historical external/PayPal.Me receipts to support review instead of offering a new unbound giving link. Account-linked one-time checkout now supports Steam and Google; monthly subscription management remains Steam-bound. See ACCOUNT-PAYMENTS.md for the durable private financial history and deployment migration. No Google-linked payment ledger was invented. Receipt and cancellation controls remain available for supported account-linked subscriptions.

Configured one-time checkout uses the existing PayPal order/capture flow. Monthly checkout is offered only after the server obtains an active plan with one unlimited monthly fixed-price cycle, no trial, setup fee or extra plan tax, and exposes its actual price/currency. Complex plans are not represented as simple monthly support. A failed server subscription-creation request no longer falls back to creating an untracked client-side subscription. PayPal remains the payment processor and approval surface.

Required production payment configuration remains `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, server-only `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`, `PAYPAL_CURRENCY`, optional `PAYPAL_SUBSCRIPTION_PLAN_ID`, production `SESSION_SECRET`, and the existing durable payment/support tables and verified webhook setup. This workspace has no live payment or database credentials. Browser payment checks use controlled fixtures; no real payment was made and live provider cancellation was not asserted.

The legal document revision records the updated funding purpose. The community’s 19+ declaration remains a browser-local declaration, not independent age verification.

## Debris rendering

`components/CelestialDebris.js` supplies six asteroid geometry/material variants with crater deformation, mineral variation, layered strata, granular relief and dark fractures. Three comet nuclei use deformed, joined lobes with patchy ice, carbon-rich surface detail, coma and stellar-direction tails. Detail remains bounded by the graphics profile, and the deterministic asteroid positions used by collision/weapon systems remain unchanged. Surface detail is generated procedurally, with no external image texture download required.
