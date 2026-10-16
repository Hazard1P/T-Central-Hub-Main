# T-Central Hub

Production-oriented Next.js base for the T-Central Hub web game and server portal.

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
- Only one admin account ID is supported by design; add more only if a future requirement calls for it.

### Required for durable contact/report storage in production
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Without Supabase, contact/report JSON persistence is available for local development only and is intentionally blocked for production so the app does not pretend data is durably stored when it is not.


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
