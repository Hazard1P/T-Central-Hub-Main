# Security and encryption baseline

## Cryptography

`lib/security/envelope.js` defines the versioned `v3.<key-id>.<base64url>` envelope. It uses Node's AES-256-GCM with a fresh 12-byte random nonce and 16-byte authentication tag. HKDF-SHA256 derives a separate 32-byte key for each caller-provided purpose. The version, key ID and purpose are authenticated additional data. Issuance and expiry times are encrypted and verified against server time. Parsers reject unknown key IDs, malformed/noncanonical encodings, oversized envelopes, future issuance, expiry and invalid tags. There is no cache indexed by attacker-supplied cookie salts.

This is authenticated encryption built from standard Node primitives, not a new cipher or a claim of formal certification. The unit tests include independent decryption using the standard Node crypto API.

Google and Steam login sessions have distinct purposes and a seven-day maximum lifetime. An arbitrary data cookie, old login cookie or another provider's cookie cannot authenticate an account. Session cookies remain HttpOnly, host-only, Secure on HTTPS and SameSite=Lax for OAuth redirects. Google login also uses S256 PKCE and a short-lived HttpOnly verifier cookie.

A first v3 deployment intentionally requires everyone to sign in again. It preserves durable account IDs, progress, contribution records and seed ownership; it does not reinterpret an old cookie as authenticated. Logging out removes the browser cookie. This does not remotely revoke an already stolen, otherwise valid session: remove its key ID from the session keyring to invalidate sessions under that key, or introduce a durable per-session revocation service if immediate individual revocation is required.

## Session keys and rotation

- `SESSION_SECRET`: current randomly generated secret, at least 32 bytes. Known template placeholders and short secrets are rejected. `openssl rand -base64 48` is an appropriate generator; place the value in the hosting secret manager, not source control.
- `SESSION_KEY_ID`: public identifier for the current key, 1–32 letters/digits/underscores/hyphens; defaults to `current`.
- `SESSION_PREVIOUS_KEYS`: optional server-only JSON map of retained key IDs to their old session secrets. It must not repeat the active ID. At most eight total keys are accepted.

For routine rotation, choose a new ID/secret and retain old IDs until their sessions expire (seven days) and any retained receipt cookies no longer need them (up to 180 days). For compromise response, retire the compromised ID immediately and expect sign-in/receipt-cookie invalidation. Do not reuse an old ID with a new secret while expecting old tokens to remain valid.

HMAC-SHA256 reference signatures also derive purpose-separated keys. Policy signatures are not restore credentials. Signed internal restores authenticate the checkpoint, build, mode and a server timestamp within 60 seconds under a distinct purpose. Operational calls normally use a separate maintenance credential.

## Private seed field encryption

Configure `DATA_ENCRYPTION_KEY_ID` and `DATA_ENCRYPTION_KEYS`, a server-only JSON map of key IDs to canonical base64 strings encoding exactly 32 random bytes. Generate data keys separately with `openssl rand -base64 32`. Session and private-data keys serve different purposes and should be independently generated, stored and rotated.

Apply `20261028_private_seed_encryption.sql` after the existing seed schema. New application seed writes store `[encrypted]` in the old body column and a v3 ciphertext in `body_ciphertext`; plaintext does not go into the new row or the development document when the application cipher is configured. The authenticated context binds the account, seed ID, cyber-intelligence ID, epoch, flight signature and content binding. New content bindings use HMAC to avoid leaving an unkeyed plaintext-guessing oracle. Public responses never include ciphertext. Missing keys or failed authentication return a storage error and do not silently replace data or write plaintext.

This migration is additive. Existing plaintext records remain readable until an operator explicitly encrypts them. A server-only migration tool performs a dry run by default and logs counts only:

```sh
npm run migrate:private-seeds
npm run migrate:private-seeds -- --apply
```

Run these with production database credentials and data keys only in an authorized maintenance environment. Writes use conditional updates so another migration or writer cannot be silently overwritten. Interrupted runs can resume. To re-encrypt retained old key IDs under the active key:

```sh
npm run migrate:private-seeds -- --rotate
npm run migrate:private-seeds -- --apply --rotate
```

Retain old data keys until all corresponding ciphertext has been re-encrypted and backups/recovery requirements are satisfied. Losing the only key for encrypted data loses access to that data. Never invent an ephemeral persistent-data key. The low-level local test adapter can still be constructed without a cipher for legacy fixtures; the application store always supplies the key-requiring cipher.

The application does not encrypt every database field. Account indexes, public messages, report evidence, payment references and other metadata continue to rely on access controls and the database provider's storage encryption. Confirm provider encryption, backup access and retention in the actual deployment. Encrypting live columns does not retroactively rewrite old backups or Git history.

## Authorization and request handling

- Every account progression read/write uses the verified cookie identity. Anonymous requests cannot choose a target account ID. Guest training remains in browser storage. Client progress sync accepts bounded discovery IDs; it cannot mint credits, VIP status or authoritative multiplayer rewards.
- Simulation-event ingestion, maintenance cleanup/symmetry checks, continuity drills/restores and legacy integration operations require the verified owner or a configured maintenance service. Unset secrets deny access. Legacy admin IDs must be paired with their provider; cookie role flags do not grant access.
- Private progress reads fail closed on database errors; production never falls back to local JSON. Raw legacy Steam IDs are recovered only from Steam-typed records and never override an exact provider-scoped account match. Private development caches/credential files are ignored by Git, private file writes use restricted permissions, and private caches are excluded from deployment tracing.
- Install `20261028_security_private_tables.sql` to revoke anonymous/authenticated Supabase access to legacy private tables and enable RLS. Private progress uses the server service-role connection. Do not put that credential in a `NEXT_PUBLIC_` variable.
- `MAINTENANCE_API_SECRET` or `CRON_SECRET` must contain at least 32 characters. Service calls use `Authorization: Bearer <secret>`; the legacy `x-cron-secret` header is also accepted. Requests compare secrets in constant time and fail closed when missing.
- API middleware rejects cross-site mutations and oversized declared payloads. Route readers enforce streamed byte limits too, including requests without Content-Length. PayPal webhooks are exempt from same-origin checks, retain signature verification and have a larger 256 KiB limit.
- API responses use private/no-store caching. HTTPS production responses receive HSTS; all pages receive MIME, framing, referrer and limited CSP protections. The CSP blocks object embedding, base-URL changes and framing. It is not a strict script-nonce CSP; that remains additional defense to implement and test separately.

## Transport and hosting

Production shared flight and mining always require the authoritative real-time service. The old `MULTIPLAYER_TRANSPORT=http` override no longer bypasses that requirement in production; legacy HTTP adapters are for development only. Public production sign-in requires HTTPS and public game/chat sockets require WSS. Loopback HTTP/WS is allowed for local validation. The persistent worker may use private HTTP behind a trusted TLS reverse proxy; publicly reachable service hops should use TLS. Configure exact allowed WebSocket origins. This code does not configure certificates, firewalls, VPNs, database backups, hosting IAM, DDoS protection or provider-side encryption automatically.

Distributed rate limits, WAF/DDoS controls, per-session revocation, optional MFA/re-authentication for owner actions, and field encryption of report/support evidence remain follow-up hardening. Existing report/chat database throttles remain in place. Do not describe a single-process limit or a local test as a guarantee against a determined attacker.

## Verification and operations

`npm test`, `npm run verify:api`, `npm run build`, `npm run security:scan`, and `npm run security:audit` exercise the application baseline. `PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite/dist/index.js npm run verify:security-db` verifies the real migration SQL against PostgreSQL-compatible tooling. The credential-pattern scan reads tracked files and reports only locations/rules, not matched values; it cannot establish that no secret has ever existed in repository history.

Deploy schema migrations, server-only key configuration, the updated website and matching game worker together. Validate actual Google/Steam sign-in, owner permissions, PayPal sandbox checkout/webhooks, mobile WebGL and backups in the deployment. No production secrets or live hosting/database access were available for this review.

Keep session, private-data and PayPal credentials on the website service only. The game worker needs its separate real-time credential, exact allowed origins and its required database connection; it does not need the website's session/data keyrings or PayPal credentials. Both services currently use privileged database connections for their server operations. Narrower database roles are additional least-privilege work, not a control supplied by this release.
