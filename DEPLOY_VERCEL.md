# Vercel deployment notes

## Required environment variables
- `NEXT_PUBLIC_APP_URL`
- `SESSION_SECRET`
- `STEAM_API_KEY` if you want enriched Steam profiles

## Optional environment variables
- `SUPPORT_LINK_SECRET`
- `STATUS_SOURCE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_MULTIPLAYER_ROOM`
- `NEXT_PUBLIC_MULTIPLAYER_MAX_SLOTS`
- `NEXT_PUBLIC_WORLD_RINGS`
- `NEXT_PUBLIC_WORLD_RING_DENSITY`

## Recommended Vercel project settings
- Framework preset: Next.js
- Node version: **20.x** (or any version matching `>=20 <23`)
- Build command: `npm run build`
- Output directory: leave empty for Next.js auto-detection

## Runtime compatibility note
- This repo uses Next.js `14.2.35`, which supports Node `>=18.17.0`.
- The project standard is Node `>=20 <23` and the Vercel runtime is set to `nodejs20.x` for API routes.

## Post-deploy checks
- `/api/health`
- `/api/auth/steam/login`
- `/api/live-status`
- `/system`


## PayPal donation flow

Add these environment variables in Vercel:
- `NEXT_PUBLIC_PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_ENV`
- `PAYPAL_CURRENCY`

Recommended webhook target:
- `/api/donations/paypal/webhook`
