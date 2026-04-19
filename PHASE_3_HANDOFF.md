# T-Central Hub — Phase 3 Handoff

This package is the consolidated Phase 1 through Phase 3 build.

## Included systems

### Phase 1 — Playable universe layer
- Cinematic universe landing scene
- Blackholes, solar systems, meteor layers, route beams, event-horizon visuals
- Playable ship / pilot movement
- Desktop and mobile control handling
- Responsive HUD and reduced-cost rendering on smaller devices

### Phase 2 — Session + observance layer
- Steam login / session routes
- Shared client session provider
- Guest and logged-in observance alignment
- Cross-tab presence sync via storage + BroadcastChannel
- Live status route integration for server cards and system state

### Phase 3 — Private universe + anchored time layer
- Private universe scope engine
- Prayer Seed storage route and summarization
- Unix epoch anchored solar timing
- Dyson alignment / relativity summaries
- Multiplayer observance snapshot model for local/shared state presentation

## Key engine files
- `lib/mathEngine.js`
- `lib/physicsEngine.js`
- `lib/quantumFieldEngine.js`
- `lib/universeEngine.js`
- `lib/universePrivacyEngine.js`
- `lib/prayerSeedEngine.js`
- `lib/epochDysonEngine.js`
- `lib/multiplayerSyncEngine.js`

## Main API routes
- `/api/auth/steam/login`
- `/api/auth/steam/callback`
- `/api/auth/steam/logout`
- `/api/auth/steam/session`
- `/api/live-status`
- `/api/report-player`
- `/api/support/session`
- `/api/support/link`
- `/api/universe/session`
- `/api/universe/prayer-seeds`

## Setup
1. Copy `.env.example` to `.env.local`
2. Fill in the values you want to enable:
   - `NEXT_PUBLIC_APP_URL`
   - `SESSION_SECRET`
   - `STEAM_API_KEY`
   - `STATUS_SOURCE_URL` (optional)
   - `NEXT_PUBLIC_SUPABASE_URL` (optional)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (optional)
3. Install dependencies:
   - `npm install`
4. Run locally:
   - `npm run dev`
5. Production build:
   - `npm run build`

## Important note
This package includes a mathematically grounded browser simulation layer and a multidimensional state model. It does not claim to be a literal full quantum-reality solver. The current implementation is designed to be playable, extensible, and truthful within a web-game deployment model.


## Vercel readiness
- `NEXT_PUBLIC_APP_URL` and metadata now resolve cleanly for localhost or Vercel hosts.
- Session, support, and Prayer Seed cookies now align across localhost and production HTTPS.
- API routes that depend on sessions or live state are marked dynamic for server freshness.
- A health endpoint is included at `/api/health` for post-deploy checks.
- See `DEPLOY_VERCEL.md` for the deployment checklist.
