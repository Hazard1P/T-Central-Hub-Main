# Player reports and account moderation

Players can report a concern at `/report-player`, including without signing in. Google and Steam reporters are linked using the verified session, never body-supplied identity. The pilot roster opens a report with the player's stable account ID. A report receives a reference only after durable storage succeeds. Reports submitted without an ID resolve to a current gamertag only when there is exactly one match; ambiguous and unknown names require an administrator to verify and select the account. Reports are allegations, not automatic bans.

## Administrator setup

1. Apply `20261027_account_usernames.sql`, `20261027_community_chat.sql`, then `20261027_player_moderation.sql` to Supabase. The moderation migration imports existing `public.player_reports` records if the old table exists and makes that legacy table private. Local development JSON reports need a separate reviewed import; they are not production moderation storage.
2. Sign in to `/profile` and copy the stable `google:…` or `steam:…` account ID. Bind the authenticated owner using the **website's server-only** `SITE_OWNER_ACCOUNT` (one complete provider-qualified account ID). The owner automatically receives moderation access and a verified-owner label in their private profile. A legacy `DYSON_ADMIN_PROVIDER` plus `DYSON_ADMIN_ACCOUNT_ID` pair also identifies the owner when the new owner setting is absent. Additional explicitly appointed moderators can use the comma-separated `MODERATION_ADMIN_ACCOUNTS` allowlist. A matching name, email, client role or supplied admin header does not grant access. Empty configuration denies everyone. Payment administration and an unscoped legacy Dyson ID do not grant this role. Repository ownership alone cannot identify a Google or Steam sign-in; an owner identity must be bound in deployment configuration.
3. Both the website and persistent game worker need `NEXT_PUBLIC_SUPABASE_URL` and **server-only** `SUPABASE_SERVICE_ROLE_KEY`, pointing to the same database. Keep the service key out of public environment variables and browser bundles. Existing game service secret, URL and allowed-origin settings still apply. Deploy matching website and game service versions after the migration.
4. Authorized users see an **Open moderation dashboard** link in their profile; the dashboard is `/admin/moderation`. Ordinary accounts and guests cannot access the moderation API, including its legacy `/api/moderation/summary` URL.

The current cloud session has no production database or hosting credentials. Committing the migration does not apply it to the live database or configure an administrator.

## Review and actions

The private dashboard includes reports, account search, active bans and the latest 50 audit entries. It lists up to 100 matching reports with open reports first. Search by current gamertag, full account ID or report reference to locate older records. Private evidence is rendered as text, never injected HTML. Reviewers can mark reports under review, resolve them, dismiss them, issue temporary/permanent bans or revoke a ban. Every action needs a reason and records the verified actor, target, report reference, server timestamp and optional expiry. Ban reasons are shown to the affected player; avoid including private witness details in them.

Temporary bans use server time and an exact duration in hours. The UI offers 1 hour, 24 hours, 3 days, 7 days and 30 days; the API allows integer durations of 1–8760 hours. A permanent ban has no expiry. Revoking a ban does not erase its audit history. SQL protects against self-bans and changing an already-bound report to another account; the API also protects configured administrator accounts. Bans never follow a mutable display name.

Reports, bans and audit records use private RLS tables and service-role-only RPC functions. The server derives reporter and actor identities from encrypted login cookies. Mutations require same-origin requests. A database-serialized 60-second report throttle applies per signed-in account or hashed guest address; missing guest address information shares a conservative anonymous bucket. No report contents are returned by the public report metadata endpoint.

## Game enforcement

Both website ticket issuance and WebSocket admission check durable bans, including tickets issued before a ban. The persistent worker rechecks all account pilots in one batched lookup every five seconds. The moderation action also sends a private service-secret notification for immediate enforcement; if delivery fails, the action stays saved and the next periodic check enforces it. All workers/rooms must share this database and run this version.

Enforcement removes the account's active flight and projectiles, closes its sockets and blocks rejoining until expiry or revocation. A renamed account remains banned. Shared economy requests and legacy HTTP sessions also check bans. Private profile/history, support, legal documents, reports and appeal contact remain available. The game shows the reason and local-time expiry and stops automatic reconnect attempts; players can use **Retry now** after expiry or revocation.

A database outage denies account joins and removes account flights at the next check rather than silently dropping ban enforcement. Guest play follows the existing guest policy: account bans cannot identify an anonymous player or a newly created alternate account, and do not restrict independent third-party Rust/Arma servers or local solo rendering. Requiring authenticated shared play or adding separate anti-evasion measures would be an additional policy change.

## Verification

- `npm test`: moderation authorization, input validation, trusted identity binding, storage failure behavior, real WebSocket live kicks, pre-issued ticket rejection, metadata changes, private service notifications and return after ban removal, alongside existing simulation tests.
- `npm run verify:simulation`: full tests, API handler checks and production build.
- `PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite/dist/index.js npm run verify:moderation-db`: optional PostgreSQL-compatible checks for rerunnable/legacy migrations, private grants, ambiguous names, report binding, rate limiting, audit records, temporary expiry, permanent bans and revocation. PGlite is optional verification tooling, not a runtime dependency.
- Browser/API fixtures use real Next routes, encrypted login sessions, the game worker and PostgreSQL-compatible storage. OAuth upstream responses are synthetic; this does not certify live provider/hosting configuration.

## Live community chat

The forum and optional **Chat** flight panel share one persistent WebSocket channel on `/chat`, separate from `/flight`, so opening chat never joins, replaces or resets a ship. Signed chat tickets use a separate audience and 30-second expiry. Guests can read; Google/Steam accounts can send. Text-only messages are limited to 500 characters, one per two seconds and five per 30 seconds, with database-serialized throttling. Recent visible history (50 messages) survives service restarts. The channel has a separate 256-connection cap and bounded socket buffers; this is not a load-tested chat capacity guarantee.

Chat reports bind to the stored sender by message UUID, never a supplied target. Administrators can hide messages in the dashboard with a reason; removal propagates immediately through a private service notification and periodic history reconciliation. Hiding retains the stored message and audit reference. Account bans block chat admission/writes and disconnect active chat sessions. Public responses exclude private account IDs, emails and moderation fields. Retention beyond the recent-history view must follow the operator's privacy/retention process; this change does not silently delete evidence.

Deploy the updated Docker image/worker with its locked Supabase dependency, and proxy WebSocket upgrades for both `/flight` and `/chat`. Apply the chat migration before the moderation migration. The server-only Supabase credentials and existing real-time service settings are required for both. The application cannot activate the owner's production account without the owner binding and production hosting access.

Release checks passed 189 automated tests, 55 API handler checks, 28 page/guest guards, the production build, real-SQL moderation/community migration checks and the minimal game-service image build/start. Browser fixtures exercised verified-owner access, Google and Steam reporting, live flight bans, expiry/revocation, private evidence escaping, 320/390px administration, subsection posting/refresh and live chat/hiding. These local fixtures do not establish that production migrations, owner configuration or hosting have been deployed.
