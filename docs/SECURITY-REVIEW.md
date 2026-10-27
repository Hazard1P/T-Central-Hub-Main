# Codebase security review — October 27, 2026

The final inventory covered 513 tracked files (505 text and eight binary), including 413 JavaScript sources and 55 API routes. The review scanned text/source files for credential patterns, audited the installed production dependency graph, and manually inspected authentication, cryptography, private persistence, API mutation paths, database grants, financial reconciliation, multiplayer admission and service/deployment configuration. The tracked-file scan reported zero credential-pattern findings. Binary assets were inventoried rather than interpreted as application source. This is a code review and local verification pass, not a penetration test or a guarantee that every vulnerability has been found.

## Findings addressed

| Finding | Change |
| --- | --- |
| Legacy encrypted login cookies had browser-only expiry and shared data-cookie cryptography | Versioned AES-GCM envelopes, provider-specific purpose separation, authenticated server-enforced expiry and explicit key rotation; legacy login cookies rejected |
| Attacker-controlled salt derivation used synchronous scrypt and an unbounded cache | HKDF from configured keys; strict parsing and unknown-key rejection; no per-cookie key cache; bounded authenticated-only legacy seed recovery |
| Anonymous progression requests could supply another account's ID | Verified owner scope; anonymous server sync denied; only bounded discovery updates accepted from the client |
| A local progress cache was tracked and production reads could fall back to local JSON | Removed the tracked cache from the source tree, retained a private workspace copy, ignored private caches/credentials, restricted file permissions, excluded caches from deployment tracing and made private database read failures fail closed |
| Legacy progression/account tables lacked a server-only permission baseline | RLS/privilege migration and service-role-only private progression persistence |
| Some maintenance/event routes allowed access when secrets were unset | Owner/service authorization, strong service-secret requirement, purpose-separated expiring restore signatures and repaired restore authorization |
| Production could explicitly opt into a legacy client-authoritative HTTP flight adapter | Production now always requires the authoritative real-time service; development adapters cannot mint production mining rewards |
| Request bodies and cross-site mutation checks were inconsistent | API-wide same-origin middleware and bounded streamed readers, preserving signature-verified external webhooks |
| Private seed text was plaintext in application storage | Separate field-encryption keyring, additive schema, metadata binding, keyed content binding and resumable dry-run/migration/rotation tooling |
| Dependency audit reported one critical, three high and one moderate vulnerable package entries | Updated Next.js, React and the matching Three renderer packages, patched transitive dependencies and pinned a patched PostCSS override; final audit results are recorded with the release checks |
| Public security descriptions claimed protections not implemented by the code | Replaced quantum/asymmetric/encrypted-physics claims with the implemented controls and deployment requirements |
| Public continuity health referenced undefined variables and wrote snapshots per request | Read-only public health summary; maintenance drill remains authorized |

## Scope and limits

All 55 API routes were included in the surface inventory. Public read-only routes include astronomy, public server/destination information and status. Account/profile/payment/seed/moderation routes authenticate verified sessions; shared state/action/disconnect routes require their opaque server flight token. Legacy maintenance and integration/event operations require owner/service authorization. PayPal webhooks retain independent provider signature verification. Browser code and graphics assets are public by design and cannot be made secret through source encryption.

Production provider configuration, TLS/certificates, secret entropy and storage, backup encryption/access, IAM, operator endpoint exposure and live OAuth/payment behavior could not be verified without deployment credentials. The database migration and existing-plaintext migration must actually run before their controls apply to existing production data. Report evidence and other database metadata are not newly field-encrypted by this release. See [SECURITY-BASELINE.md](SECURITY-BASELINE.md) for remaining work and exact deployment/rotation steps.

The removed local progress cache contained three records. No record contents are reproduced here. Removing the file from the current tree does not remove it from existing Git history; history rewriting and any disclosure/retention review are separate operations and were not performed automatically.

## Release verification

- All 201 automated tests, API-route verification and the production Next.js build passed.
- Both the website and minimal game-worker production dependency audits reported zero known vulnerabilities at review time. This is an advisory-database result, not a guarantee about unknown vulnerabilities.
- Local HTTP integration checks covered authenticated provider isolation, session expiry/tampering, Google PKCE, account progression authorization, owner/service permissions, request limits, same-origin controls and private seed storage. Production rejected legacy HTTP/in-memory flight overrides without the authoritative worker.
- PostgreSQL-compatible database checks exercised the real additive migrations, grants and encrypted seed constraints. The actual seed migration CLI passed dry-run, application, repeat-run and key-rotation checks, with application readback of rotated records.
- Controlled provider fixtures passed Steam/Google callback and PayPal ownership, capture/retry, signature verification, refund and recurring-record checks. No live account login, charge or production webhook was performed.
- Browser checks covered 28 page routes and guest admin restrictions, phone profile/username behavior, desktop flight/braking, authoritative combat/respawn, mining/delivery rewards, native touch controls and adaptive canvas sizing at 320, 390 and 844 pixels. WebGL initialization reported no page/shader errors. Software WebGL draws were disabled during timing-sensitive physics checks after initialization; other display checks used normal rendering. These checks do not replace testing on physical phones.
- The minimal production game-worker Docker image built successfully and its health endpoint started with the expected physics version and configured 128-player capacity. Capacity is configuration, not a 128-player load-test result.

Validation used synthetic accounts, loopback services and local fixtures. Deployment migrations, keys, hosting controls and live provider configuration remain operator deployment steps described in the baseline.
