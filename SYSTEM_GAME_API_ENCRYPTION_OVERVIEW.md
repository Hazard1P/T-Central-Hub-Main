# System + Game + API + Encryption Overview

This document provides a practical map of the repository by runtime responsibility, then proposes an upgraded encryption/security baseline and operating procedure.

## 1) Repository topology by responsibility

## Server files (HTTP/API, persistence, privileged runtime)

- `app/api/**/route.js`
  - Primary incoming request surface (web/API entry points).
  - Handles moderation, multiplayer, donations, reporting, live status, support, and external ARMA integration.
- `lib/server/**`
  - Server-only adapters and integrations (`supabaseAdmin`, telemetry, donation store).
- `supabase/migrations/*.sql`
  - Persistent schema/state evolution for multiplayer, progression/moderation, donations ledger, and simulation events.
- `vercel.json`
  - Deployment/runtime behavior for Vercel.

## Game files (simulation/gameplay/domain logic)

- `lib/*Engine.js`
  - Core simulation and game domain logic:
    - `gameEngine`, `physicsEngine`, `renderEngine`, `shipEngine`, `gravityEngine`, `planetarySystemEngine`
    - Multiplayer/game-state specializations: `multiplayerSyncEngine`, `authoritativeMultiplayerStore`, `durableMultiplayerStore`
    - Universe/simulation systems: `universeEngine`, `proceduralUniverse`, `simulationConfig`, `simCore/stepFrame`
- `lib/world*.js`, `lib/serverCatalog.js`, `lib/gameAssets.js`
  - World descriptors, layout helpers, server metadata and game asset references.
- `data/player-progression.json`
  - Local development fallback progression data.

## Independent/supporting files

- `components/**`
  - UI control surfaces and views (status, multiplayer HUD, moderation panel, security standards panel, etc.).
- `app/**/page.js`
  - Route-level UI pages and public policy pages.
- `scripts/verify-api-routes.mjs`
  - API route verification utility.
- `README.md`, `DEPLOY_VERCEL.md`, `SUPABASE_MULTIPLAYER_SETUP.md`
  - Ops and deployment docs.

## System integration files

- `lib/integrations/synapticsSecondsMeterAdapter.js`
  - Integration adapter boundary.
- `lib/supabaseClient.js`, `lib/server/supabaseAdmin.js`
  - Database integration clients.
- `lib/paypal.js`, `lib/paypalWebhookStore.js`, `app/api/donations/paypal/**`
  - Payment integration and webhook processing.
- `lib/steamAuthUrl.js`, `lib/steamAccess.js`, `components/Steam*`
  - Steam auth/session/game-mode integration.
- `app/api/arma/integration/route.js`
  - ARMA-specific inbound integration endpoint.

## Source code areas by runtime domain

- Frontend: `app/**`, `components/**`
- Shared business logic: `lib/**`
- Server-side request handlers: `app/api/**`
- Data schema/runtime persistence: `supabase/**`
- Tooling/scripts: `scripts/**`

## 2) Incoming and outgoing API/data flow

## Incoming (to your system)

- Browser -> Next.js App Router pages and `app/api/**` routes.
- Third-party services -> webhook/integration routes (`paypal/webhook`, `arma/integration`, support/session link endpoints).
- Multiplayer clients -> `app/api/multiplayer/*` and simulation event routes.

## Outgoing (from your system)

- Next.js server -> Supabase (admin + client SDK paths).
- Next.js server -> PayPal APIs for order create/capture workflows.
- Next.js server -> telemetry/analytics sinks (`lib/server/vercelTelemetry.js`).
- Server-generated session/security tokens/signatures -> client cookies/headers/response payloads.

## 3) Existing security baseline in code

- Session secret enforcement in production and ephemeral fallback in non-production (`lib/security.js`).
- Authenticated encryption via AES-256-GCM with per-payload salt (v2 payload format) (`lib/security.js`).
- Key derivation and HMAC signing utilities for integrity (`lib/security.js`).
- Security policy constants and high-level standards declaration (`lib/securityConfig.js`).

## 4) Recommended better encryption/security standard

Adopt a formal **"Crypto + Transport + Key Management Standard v3"** with the following:

1. **Transport (mandatory):**
   - TLS 1.3 only where possible; redirect all HTTP->HTTPS.
   - HSTS enabled with preload-ready policy.
   - Strict CSP with nonce-based script policy for dynamic pages.

2. **Symmetric encryption at rest/in-token:**
   - Keep AES-256-GCM for structured payload encryption.
   - Add explicit key identifiers (`kid`) to encrypted payload metadata.
   - Enforce authenticated additional data (AAD) containing: version, purpose, tenant/lobby scope, issued-at.

3. **Key management:**
   - Move from env-only long-lived secret toward KMS-backed data keys.
   - Rotate master keys on a fixed schedule (e.g., every 90 days).
   - Maintain dual-read window for legacy keys (active + previous) for safe rotation.

4. **Integrity and request authentication:**
   - Use HMAC-SHA-512 (already present) with rotating key versions.
   - Add timestamp + nonce anti-replay for sensitive inbound integrations/webhooks.
   - Validate webhook signatures before JSON parsing when provider supports it.

5. **Credential and secret handling:**
   - Separate secrets by function: session, encryption, webhook verification, API signing.
   - Enforce minimum entropy and length checks at startup.
   - Disallow fallback weak defaults in staging/production.

6. **Data minimization + privacy controls:**
   - Keep identifiers pseudonymized/hashes where full identifiers are unnecessary.
   - Store only minimum gameplay event payload needed for simulation reconciliation.

## 5) Security procedure (operational runbook)

## A) Release-time procedure

1. Run static route verification and build checks.
2. Validate that required secrets are present for target environment.
3. Confirm key version matrix (`active`, `previous`) before deployment.
4. Deploy with migration ordering: schema first, API second, UI third.

## B) Key rotation procedure

1. Provision new master key material in secure secret store.
2. Set new key as `active`, keep prior as `previous`.
3. Deploy code that writes with new key and reads both keys.
4. Re-encrypt long-lived payload stores asynchronously.
5. After expiry window, remove previous key and close rotation ticket.

## C) Incident response procedure (crypto/webhook compromise)

1. Freeze affected integration endpoint(s) with maintenance mode/denylist.
2. Rotate compromised verification key immediately.
3. Revoke outstanding sessions signed/encrypted with compromised key.
4. Audit event stream for replay windows and suspicious nonce reuse.
5. Restore service with heightened logging and temporary anomaly thresholds.

## 6) Priority implementation backlog

1. Add webhook timestamp/nonce validation middleware for all inbound external routes.
2. Add `kid` support to `encryptJson`/`decryptJson` payload format.
3. Add centralized secret validation at boot (hard-fail in production/staging).
4. Add structured audit log envelope for incoming/outgoing integration calls.
5. Add automated key-rotation test coverage (read old/write new).

---

If you want, the next step can be a **concrete hardening patch set** that implements items #1-#3 immediately across current API routes.
