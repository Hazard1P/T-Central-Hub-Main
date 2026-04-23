# Durable Multiplayer Hub Setup

This package is prepared for a durable multiplayer hub on Vercel by using:

- Next.js on Vercel for the web/game shell
- Supabase Postgres for durable room state
- Supabase Realtime for player/event fanout
- Vercel API routes for secure room/session actions

## 1) Create the Supabase schema

Run the SQL in:

- `supabase/migrations/20260419_multiplayer_hub.sql`

That creates:

- `multiplayer_rooms`
- `multiplayer_players`
- `multiplayer_events`

and enables those tables for Realtime.

## 2) Add environment variables in Vercel

Set the values from `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_MULTIPLAYER_ROOM`
- `NEXT_PUBLIC_MULTIPLAYER_MAX_SLOTS`
- `SIM_EVENT_VALIDATION_MODE` (`true` to force 100% simulation event capture for targeted validation sessions)
- `SIM_EVENT_VALIDATION_ROOMS` (comma-separated room names or `*`)
- `SIM_EVENT_VALIDATION_SESSIONS` (comma-separated session tokens or `*`)
- `CRON_SECRET`

## 3) Deploy

Standard deploy:

```bash
npm install
npm run build
vercel --prod
```

## 4) Cleanup job

The project includes a cleanup route at:

- `/api/multiplayer/cleanup`

Use the `CRON_SECRET` header if you trigger it from an external cron, or keep the built-in Vercel cron in `vercel.json`.

## 5) Runtime model

- room/session actions go through secure API routes
- player/world state is stored durably in Postgres
- client fanout comes from Supabase Realtime subscriptions
- if durable config is missing, the app can still fall back to the session-based in-memory authority layer for development

## 6) Production note

This is a durable multiplayer hub foundation for roaming, presence, shared state, and combat-ready world events.
For very high-frequency twitch movement/combat at large scale, move the simulation tick to a dedicated stateful game service later and keep Vercel for the web shell and control APIs.
