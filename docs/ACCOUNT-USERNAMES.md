# Account usernames

Google accounts can choose a public gamertag in **Profile → Account username**. The first choice is available immediately. Later changes require 30 full days (720 hours) after the last successful change, including across daylight-saving changes. A case-only change counts as a change. Saving the exact same name is a no-op and does not move the timer. Names use 3–24 A–Z letters, digits, underscores or hyphens, beginning with a letter or digit. Compatibility characters are normalized before validation. Claimed Google names are unique, ignoring capitalization.

Before selection, Google accounts receive a stable `Pilot-…` placeholder derived from their verified provider identity. Public naming does not fall back to their Google full name or email. Google profile data remains available only in the account's existing private session. Old community posts retain their original author snapshot; new posts use the current account gamertag.

Steam accounts use the verified Steam persona name. The website does not offer a separate editable Steam username or apply Google's rename timer to Steam. Change the persona on Steam and sign in again to synchronize it. Production Steam profile lookup requires `STEAM_API_KEY`; OpenID alone proves the Steam ID but does not supply a persona name. Missing profile data does not erase a previously stored verified name.

## Persistence and authority

Apply `supabase/migrations/20261027_account_usernames.sql` before deploying the matching website. The migration is rerunnable and adds a private `account_usernames` table plus the service-only `account_username` RPC. It leaves existing wallets, contributions, seeds, provider IDs and account progression intact. Google and Steam namespaces remain separate even if their raw provider IDs match.

The RPC locks the account row, reads database wall time after acquiring the lock and atomically updates the name and timestamp. A partial unique index arbitrates Google name claims. Anonymous and authenticated database clients cannot read the table or invoke the RPC; only the server service role can do so. `/api/account/username` derives the provider/account from encrypted verified cookies, requires same-origin mutation requests and accepts no client-supplied owner or clock. Missing durable storage disables editing with an unavailable response; it never grants an unsaved rename or resets a cooldown.

Session, profile, community posting, progression and multiplayer entry points resolve the durable public name. Renaming does not change the account key. A successful update also sends trusted metadata to the private game-service `/identity` route. Active flights update their name without a disconnect, token rotation, movement reset or cargo loss. If that service is temporarily unavailable, the durable rename still succeeds and the next join resolves it. Cosmetic username refreshes do not restart the shared-flight hook.

## Verification

`npm test` includes validation, stable placeholders, verified owner binding, error handling, public post naming and live-world metadata preservation. The optional PostgreSQL-compatible check runs with `npm run verify:usernames-db` after installing PGlite in a tooling environment, or with `PGLITE_MODULE_PATH` set to its module path. It exercises migration reruns, first choice, cooldown boundaries, DST duration, queued changes, uniqueness, login preservation, no-op saves, Steam synchronization and database grants. PGlite queues transactions in one process; production multi-connection load remains a PostgreSQL deployment check.

Local OAuth fixtures validate Google and Steam through the real callbacks, encrypted cookies, private API, database and signed WebSocket joins. Upstream provider responses are mocked; these checks do not establish live provider credentials or production migration readiness.

The release passed 173 automated tests, the production build and the optional real-SQL migration check. API/browser fixtures verified two independent Google accounts, invalid/taken names, client-clock/owner forgery rejection, exact 30-day duration, login preservation, read-only Steam names with emoji, public post naming and signed flight names. A browser form save updated an already-active flight while preserving its connection, token and position. Live provider calls and production credentials were not exercised.
