# T-Central Hub Deployment Audit Revision

## Verified checks

- `npm ci --no-audit --no-fund` completed successfully.
- `npm run verify:api` passed: all API route files expose explicit HTTP handlers.
- `npm run check:dyson-continuity` passed: canonical Dyson continuity gates are valid.
- `NEXT_TELEMETRY_DISABLED=1 npx next build --debug` completed successfully.

## Deployment revisions applied

1. **Pinned Vercel Node runtime to Node 24.x**
   - Updated `package.json` and `package-lock.json` from a broad Node range to `24.x`.
   - This avoids the recurring Vercel deployment/runtime mismatch previously seen with discontinued or invalid Node versions.

2. **Preserved Next.js CPU limiting**
   - `next.config.js` keeps `experimental.cpus = 1`.
   - This prevents worker overload and build-worker hanging on heavier 3D/static generation passes.

3. **Confirmed Vercel function config is valid**
   - `vercel.json` uses framework-level Next.js deployment and duration limits only.
   - No invalid `runtime` field is present.

4. **Confirmed static and dynamic route output**
   - Public pages prerender successfully.
   - API routes and `/admin/dyson` are correctly treated as dynamic server-rendered routes.

## Notes for Vercel environment variables

The app can deploy without all integrations enabled, but live production features need these values where applicable:

- `NEXT_PUBLIC_SITE_URL`
- `ADMIN_API_KEY`
- `STEAM_API_KEY`
- `STEAM_RETURN_URL`
- `STEAM_REALM`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_ENV`
- `CRON_SECRET`

## Build result

The package is deployable to Vercel after this revision.
