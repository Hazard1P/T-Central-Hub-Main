# Shields, hull repair and cooperative mining

This development adds server-controlled recovery and per-hit ore rewards to the existing shared-flight loop. The persistent game service owns hull/shield changes. The service-only economy transaction owns asteroid integrity, cargo, credits and receipts.

## Checks

- `node --test tests/*.test.mjs`: 128 tests passed, including damage versus shield absorption, forged client health/damage claims, Earth service boundaries, firing/damage recovery delays, destruction/respawn, cooperative mining, cargo limits and receipt replay.
- `npm run build`: production Next.js build passed. API verification checked 52 route handlers; local page smoke checks passed for 26 routes and guest admin guards.
- A local PostgreSQL-compatible PGlite fixture applied the existing economy migration followed by `20261024_cooperative_mining.sql`. All 96 rock/laser combinations matched the JavaScript rules, including finite yield and overkill. Three account owners received 2/2/3 ore from one seven-ore rock. Prior receipts replayed unchanged, regeneration reset integrity, and anonymous table/function access was denied.
- Two independent browser pilots shared the same rock integrity and depletion. Their hits loaded 3 and 1 ore respectively from one four-ore asteroid. The graphics rendered without shader errors. A separate cookie-authenticated Google callback fixture joined the real WebSocket service, mined, delivered to Earth and verified receipt replay and private profile access; upstream OAuth was mocked.
- A Chromium touch-browser check verified critical hull, automatic Earth repairs, firing that interrupts recovery, Shipyard instruments and non-overlapping cargo/combat instruments at 320px, 390px and 844px landscape widths. The wounded starting state was set by an isolated test fixture outside the product; recovery and firing used the actual server loop.

The database REST adapter, synthetic credentials and controlled starting-position/health fixtures are outside the repository. No production backdoors or new dependencies were added. Browser emulation does not establish physical phone frame rates, and local load does not establish public hosting capacity.

## Local multiplayer load

`REALTIME_TEST_SECONDS=30 node scripts/verify-realtime-population.mjs` admitted 128 synthetic WebSocket pilots, rejected the overflow connection and delivered continuous snapshots to every admitted pilot. The final 30.01-second run measured 18.5 simulation steps/second, 171–174 snapshots per pilot (about 5.7/second), and 499.82 MiB of aggregate wire traffic. Recovery timers are sent only to their owning pilot; public health/shield values are rounded to two decimals without changing server damage calculations.

This run is below the service’s 20 Hz simulation / 10 Hz snapshot targets. The synthetic clients and service share one local Node process, and the result is not a production capacity approval. Profile and tune the deployed host and measure separate real clients before advertising a smooth 128-player service.

## Rollout

Apply `supabase/migrations/20261024_cooperative_mining.sql` after the existing economy/capacity migrations, then deploy the matching website and persistent game service. Existing wallets, credits, upgrades, rocks and receipts are preserved. Partially mined rocks are not paid retroactively for old-rule hits. The new transaction pays each subsequent hit from the remaining integrity budget.

The website alone cannot host the authoritative WebSocket process. Production still needs the persistent TLS game host, website-to-service secret, exact allowed origins and protected Supabase configuration described in [deployment](../SUPABASE_MULTIPLAYER_SETUP.md). No live production deployment or migration application is implied by repository verification.
