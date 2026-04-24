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
npm install
npm run dev
```

## Production build
```bash
npm install
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
