# Real-time multiplayer deployment

Shared Play now uses a persistent authoritative WebSocket game service. Next.js serves the website, signs short-lived join tickets from verified Google/Steam or guest cookies, and mediates account/economy requests. The game service runs flight and combat at 20 Hz and streams snapshots at 10 Hz. Supabase stores account, financial and ship-economy records. Vercel API functions do not host the WebSocket simulation.

## Start the game service

Use Node 24 and `npm ci`, then configure the game-service process:

```dotenv
REALTIME_SERVER_SECRET=<generate-a-random-secret-of-at-least-32-characters>
REALTIME_ALLOWED_ORIGINS=https://t-central.me
MULTIPLAYER_MAX_PLAYERS=128
PORT=8080
```

Run `npm run server:realtime`. Origins are an explicit comma-separated allowlist; include the actual `www` or preview origin only when needed. Use a persistent container or VM with WebSocket upgrades, TLS termination, a restart policy and idle timeouts above 30 seconds. `/healthz` is a public health check; other HTTP service endpoints require the server secret. Keep the private HTTP service behind network access controls where the host supports them.

A minimal container uses only the server's locked `ws` and `astronomy-engine` dependencies:

```bash
docker build -f server/Dockerfile -t tcentral-space .
docker run --env-file /secure/path/realtime.env -p 8080:8080 --restart unless-stopped tcentral-space
```

In a managed Codex build, additionally pass `--secret id=proxy_ca,src="$CODEX_PROXY_CERT"` to trust the session proxy. Do not place production secrets in source control or image layers.

## Connect the website

Configure the website deployment with:

```dotenv
APP_URL=https://t-central.me
REALTIME_SERVER_URL=https://your-game-service.example
NEXT_PUBLIC_REALTIME_WS_URL=wss://your-game-service.example/flight
REALTIME_SERVER_SECRET=<the-same-server-only-secret>
NEXT_PUBLIC_MULTIPLAYER_ROOM=tcentral-main
```

The private service URL may instead use a reachable private HTTP address. Browser connections need public `wss://` when the website uses HTTPS. Redeploy the website after configuration. Only `NEXT_PUBLIC_REALTIME_WS_URL` is public; never prefix the secret with `NEXT_PUBLIC_`. The launcher queries live admission status. Production shared flight reports unavailable when this configuration is absent instead of silently substituting solo flight.

For local browser development use `APP_URL=http://localhost:3000`, an allowed origin of exactly that address, `REALTIME_SERVER_URL=http://127.0.0.1:8080` and `NEXT_PUBLIC_REALTIME_WS_URL=ws://localhost:8080/flight`. Start the web and game processes separately. `localhost` and `127.0.0.1` are different origins.

## Account and economy persistence

Apply the repository's Supabase migrations in filename order, including the existing account/payment migrations and `20261022_ship_economy.sql` / `20261023_multiplayer_capacity.sql` / `20261024_cooperative_mining.sql`. Set `NEXT_PUBLIC_SUPABASE_URL`, the appropriate public anon key, `SUPABASE_SERVICE_ROLE_KEY`, a stable `SESSION_SECRET`, and the Google/Steam callback settings in `.env.example`. The service role stays on the website server. Raw room, token, economy and audit tables are server-only. Public anonymous subscriptions to those tables must remain disabled.

Economy actions read the ship position from the game service and use service-only transactional wallet/rock/receipt operations in Postgres. Clients cannot submit credited positions or rewards. Account credits and installed upgrades persist; carried ore belongs to the current flight and is discarded on destruction, room change or emergency return. A reconnect during the active 30-second lease resumes that flight. Account seeds and private contribution records never enter public room snapshots.

Apply `20261024_cooperative_mining.sql` before deploying the matching website and game service. Mining awards each hit its share of a finite 4–7 ore yield instead of paying only the finisher. The migration replaces the service-only transaction function, preserving wallets and old receipts. No payment or contribution changes are involved.

## Combat and admission rules

- One service process admits up to 128 pilots total, across all named rooms. Set `MULTIPLAYER_MAX_PLAYERS` lower for smaller hosts. A full service rejects admission; additional room names do not bypass the limit.
- Every service tick uses fixed 50 ms steps. Clients send controls and aim; their frame duration, position and hit claims do not control the simulation. A server stall catches up at most 250 ms.
- Ships have 60 shield and 100 hull. Pulse cannons deal 20 damage, fire at most every 200 ms, sweep for celestial/ship collisions, and expire after 2.2 seconds. Shield regeneration starts five seconds after the last damage or firing at 6 points/second. Hull repairs are free and automatic at 8 points/second outside Earth’s surface, within 4.2 Earth radii and at or below 8 u/s, after the same combat delay. Recovery runs only on the game server after hit resolution; clients cannot request a heal or choose its elapsed time.
- Spawn protection lasts five seconds or until firing. Destruction rotates the flight credential, discards cargo, and respawns near Earth after five seconds in the same room. Kills/losses are session statistics, with no combat currency reward.
- Snapshots prioritize up to 31 nearby peers; a complete roster arrives once per second. Scene rendering budgets detailed ships and uses instanced markers for other nearby pilots. WebSocket compression is disabled to keep the simulation independent of compression-worker saturation. Size bandwidth for crowded scenes as well as CPU.
- Broken connections brake after 250 ms without controls and retain their slot for a 30-second heartbeat lease. Clean exits release the slot. Joining the same account elsewhere replaces its old connection; changing rooms creates a new flight.

This is a single authoritative game-service process. Do not horizontally replicate the same rooms behind random load balancing: each process owns independent world state. Multi-node routing, world persistence, latency compensation and larger populations need further implementation and measured hosting capacity. Running world transforms, projectiles and combat scores reset on process restart; account ledgers and upgrades remain in Postgres.

## Verification

```bash
node --test tests/*.test.mjs
npm run build
node scripts/verify-realtime-population.mjs
```

The population script launches its own loopback service and synthetic clients, checks 128 admissions plus overflow rejection, and measures simulation cadence and traffic during movement/fire. It does not target production. See [validation evidence](docs/REALTIME-VALIDATION.md) and the [request integration record](docs/REQUEST-INTEGRATION.md). Before public launch verify actual TLS/upgrade routing, origins, credentials, database migrations, two separate networks, target phone browsers, long-duration load, memory, bandwidth and host latency.

## Legacy HTTP adapter

`MULTIPLAYER_TRANSPORT=http` explicitly enables the previous HTTP polling adapter for regression or rollback. It uses the Supabase room tables and atomic capacity RPC from `20261023_multiplayer_capacity.sql`; a non-production single-process memory adapter is also available. It does not implement the new authoritative PvP combat loop. `scripts/verify-exploration.mjs` and `scripts/verify-multiplayer-population.mjs` exercise that adapter. Supabase Realtime subscriptions are not the game transport. The existing authenticated cleanup cron applies to legacy database room rows, not the live WebSocket service.

## Physics version

The shared core is `universe-physics-1`. Deploy the website and service together; the worker owns the physics epoch and sends `physicsUtcMs` with snapshots for replay. Planetary gravity, vacuum coasting, swept surfaces, ship impulses and moving-target projectile checks are described in [the physics engine](docs/PHYSICS-ENGINE.md). No additional database migration is needed for the engine itself.
