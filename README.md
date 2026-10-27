# T-Central Hub

Production-oriented Next.js base for the T-Central Hub web game and server portal.

## Current community experience

T-Central currently has no active Rust or Arma 3 servers of its own. The server pages now provide selectable third-party discovery, with source timestamps and direct ranking links when the feed is unavailable. Community posts support Steam/Google identities, headings, optional subheadings and background synchronization. Voluntary contributions fund ongoing development, marketing, hardware and project infrastructure.

Account-bound contribution records, private financial analytics and the future VIP record structure are described in [account payments](docs/ACCOUNT-PAYMENTS.md). VIP sales remain unavailable until actual offers are defined.

See [community deployment and verification notes](docs/COMMUNITY-EXPERIENCE.md) for the required database migration, provider configuration and remaining live-service checks.

## Stack
- Next.js 14 App Router
- React 18
- Three.js / React Three Fiber / Drei
- Optional Supabase for durable form and moderation persistence
- Vercel-targeted deployment

## Production baseline included in this package
- cleaned route/page continuity (`/about`, `/contact`, `/status`, `/system`)
- layered cinematic background and HUD separation
- contact and player report APIs with durable-storage safeguards
- Node LTS alignment across local CI and Vercel (20.x / 22.x / 24.x)
- hardened runtime URL handling and session crypto requirements
- `.env.example` and `.gitignore` for repeatable future development

## Environment setup
Copy `.env.example` to `.env.local` for development, or configure the same values in Vercel.

### Required in production
- `NEXT_PUBLIC_APP_URL`
- `APP_URL`
- `SESSION_SECRET`
- `DYSON_ADMIN_ACCOUNT_ID`


### Optional admin hardening
- `DYSON_ADMIN_PROVIDER` can be set to `steam` or `google` when the configured `DYSON_ADMIN_ACCOUNT_ID` should only be accepted from one auth provider.
- The legacy Dyson editor uses its own single-account configuration. Player moderation uses the separate provider-qualified `MODERATION_ADMIN_ACCOUNTS` allowlist.

### Player moderation

See [Player moderation setup](docs/PLAYER-MODERATION.md) for the private report queue, temporary/permanent account bans, revocation and audit history. Bind `SITE_OWNER_ACCOUNT` to the owner's stable account ID from `/profile` (and use `MODERATION_ADMIN_ACCOUNTS` for additional moderators); apply the moderation migration and give both website and game worker the server-only Supabase service role.

### Required for durable contact/report storage in production
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (contact forms)
- `SUPABASE_SERVICE_ROLE_KEY` (private reports/moderation; website and game worker)

Contact JSON persistence is available for local development only and is intentionally blocked for production so the app does not pretend data is durably stored when it is not. Player reports and bans require durable Supabase storage and fail closed when unavailable.


## Supported Node versions
- **Required by Next.js 14.2.35**: Node.js `>=18.17`.
- **Repository policy (contributors + local CI)**: use active/maintenance LTS lines `20.x`, `22.x`, or `24.x`.
- **Vercel deployments**: supported Node majors are `20.x`, `22.x`, and `24.x`; this repository defaults to `24.x` unless explicitly pinned in project settings.

## Local development
```bash
npm ci
npm run dev
```

## Production build
```bash
npm ci
npm run build
npm run start
```

## Deploying to Vercel
1. Import the project into Vercel.
2. Set Node.js to 24.x (default) or 22.x/20.x if your project settings expose a runtime selector.
3. Add the environment variables from `.env.example`.
4. If using contact/report flows in production, configure Supabase first.
5. Deploy.

## Operational API quick checks
- `/api/health`
- `/api/auth/steam/login`
- `/api/live-status`

## Notes
- The `data/` directory is for local development fallback only.
- The current package is intended to be the cumulative base for future updates.

## Validate the site
Use Node 24 and npm 10.8.2, as pinned in `package.json`.

```bash
node --test tests/*.test.mjs
npm run verify:api
npm run check:dyson-continuity
node scripts/verify-supabase-migrations.mjs
npm run build
```

With the app running in another terminal, check every page route and the guest admin guard:

```bash
APP_SMOKE_BASE_URL=http://127.0.0.1:3000 node scripts/verify-pages.mjs
```

Stop the development server before building; both use `.next`. The page check uses anonymous requests and does not submit forms or exercise external login/payment services. Review desktop and mobile layouts, keyboard consent, server-address copying, and the simulation launcher when changing shared UI. The legacy `/admin/dyson-assets` address redirects to the protected `/admin/dyson` page.

## Simulation visuals
Launch `/system` to enter the rendered flight scene. The **Settings → Visual quality** selector offers Auto, High, and Performance. Auto uses a lighter shader, fewer stars/asteroids, a 1x render-resolution cap, and no bloom on mobile. High enables bloom with a bounded resolution; Performance keeps the scene detail while reducing GPU work on desktop too.

Use **Hide HUD** (or H) for an unobstructed scene and **Show HUD** to restore controls. Move the mouse over the scene to steer; hold click or V to fire. Moving over account or settings controls does not turn the camera. Nebulae, planet surfaces, stars, and accretion disks are generated locally, so the new visual assets need no external texture service. Reduced-motion preferences stop animated nebula and surface effects while flight and orbital simulation continue.

### Flight controls
Keyboard flight is active when focus is on the scene. Text fields, selectors, buttons, and links keep their normal keyboard behavior. Releasing a key, switching away from the window, or hiding the tab clears held inputs. The H shortcut is attached only while the simulation is running.

On touch devices, hold a direction, Boost or Fire with separate fingers, and drag open space to steer at the same time. Each finger releases independently; cancelled touches also stop their input. **Recenter view** in Settings restores the forward camera heading without teleporting the ship or resetting progression.

### One continuous universe

All active simulation destinations share one coordinate system and the selected multiplayer room. Solar System bodies are farther out in the same space; destination selection and arrival never change rooms or reset the ship. Cruise uses automatic deep-space thrust and slows near objects. The camera rebases its render origin for precision without changing authoritative positions. See [Solar System flight](docs/SOLAR-SYSTEM.md) for scale and astronomical fidelity.

Celestial dimensions and Earth spawn/return behaviour are documented in [UNIVERSE-SCALE.md](docs/UNIVERSE-SCALE.md).

Shared Play uses the dedicated 20 Hz WebSocket game service for flight, pulse combat and Earth respawns. Deploy it alongside the Next.js website using [real-time setup](SUPABASE_MULTIPLAYER_SETUP.md). See the [request integration record](docs/REQUEST-INTEGRATION.md) for implementation and deployment status.

Run `npm run verify:simulation` on Node 24 to test the shared flight/combat/mining code, verify API route exports and build the website. GitHub Actions runs this check for pull requests and main/development pushes. [Physics integration and limits](docs/PHYSICS-ENGINE.md) describes the shared collision rules, cannon geometry and required matching website/game-service versions.

Balanced flight now brings outer destinations 20% closer while preserving the large real Solar System. Precision, Transit and Deep space assistance blend automatically, with eased acceleration and braking ahead of arrival. Deploy matching physics-v3 website and game-service versions; see [universe scale](docs/UNIVERSE-SCALE.md).

Google players can choose an account gamertag in Profile and change it after a minimum of 30 days; Steam accounts use their verified Steam persona. Apply the [username migration and setup](docs/ACCOUNT-USERNAMES.md) for durable editing. Phone play now follows the visible viewport and adjusts Auto render resolution as performance changes, including rotation and browser-toolbar changes.

### Flight plan, forum and live chat

`/our-flight-plan` explains the project's direction and is linked from the main navigation, footer and About page. The community board offers four sections and 13 subsections, with server-filtered feeds, persisted headings/subheadings and cross-tab refresh. Apply `20261027_forum_sections.sql` after the existing hub-post migrations. Live chat uses the persistent game worker, the chat/moderation migrations and a separate `/chat` WebSocket upgrade route; see [moderation and chat setup](docs/PLAYER-MODERATION.md).
