# Playable universe

Launch `/system` to fly. The default HUD has a toolbar and a compact speed, waypoint distance and bearing readout. Explore, Pilots and Settings open one panel at a time; `H` hides the HUD and `M` opens destinations. Sign in on the homepage; private discoveries belong to the account collection at `/profile`.

## Exploration

Launch starts near Earth in the enlarged, time-synchronized Solar System. The Sun, planets and Earth GEO beacon are normal destinations in the same universe; fictional deep-space destinations lie beyond the outer planets. Select one in Explore and cruise or fly there continuously. Travel never changes rooms or resets the ship. See [SOLAR-SYSTEM.md](SOLAR-SYSTEM.md) for global scale, deep-space assist, live UTC and Earth GEO.

- Fly with WASD/arrows, Space/R to rise, Shift/F to descend, Ctrl to boost and X to brake. Move the mouse to steer without holding a button; hold click or V to fire pulse cannons. Clicking optionally locks the pointer; Escape releases it. Touch devices have independent thrust, boost and Fire holds plus drag steering.
- Select a destination, then **Face destination** to orient without moving, or **Cruise to destination** to travel using bounded thrust. Steering or manual thrust cancels cruise. **Cancel cruise** returns manual control; automatic braking is enabled initially and can be changed in Settings.
- Cruise approaches a viewing point outside a planet, ring system or structure. Outer-world viewing points stay within the existing simulation bounds. The numeric guard encloses the outer Solar System; physical Solar bodies enforce safe surface boundaries. Enlarged black holes, Dyson structures and planetary surfaces also enforce shared clearances; solo private bodies use the same local rules.
- Discoveries record proximity to the selected landmark. Selecting a distant landmark does not count as a visit. Existing progression hydration and persistence remain in place.
- Halcyon, Pelagos and The Drift are defined in `lib/exploration.js`; rendering and navigation share those landmark definitions. Hub anchors and owned solo-world nodes are also selectable. Sealed system controls and unused relay actions are omitted.

## Shared flight

The hidden account-bound encounter is documented separately in [PRAYER-SEEDS.md](PRAYER-SEEDS.md), including its Unix epoch binding, account privacy and database migration.

Choose **Pilots → Shared universe**, enter the same room name on each device, or copy the invite link. Room names allow 1–64 letters, numbers, dashes and underscores. A room name is a rendezvous address, not an access-control secret. Guests can fly together. Pilots appear as ships, and the roster can set a waypoint to a pilot's last shared location.

`useSharedFlight` keeps one network request in flight and polls 250 ms after a successful response. Errors back off, expired sessions rejoin, and slow requests time out. Guest identity comes from an opaque HttpOnly browser-session cookie; a public roster ID cannot be supplied to claim another guest's session. HUD telemetry publishes at 10 Hz independently of rendering. Each request sends unacknowledged input frames, and the client replays remaining frames after a server acknowledgment. Both in-memory and durable stores use `advanceFlightBatch`, which bounds simulated time by elapsed server time, rejects invalid frame durations and does not apply an acknowledged frame twice. The server never accepts a client position as authoritative.

All destinations share global coordinates and the chosen room. Pilots remain in that room across every stellar and planetary approach. Only explicit room/mode changes, leaving the simulation, expired-session recovery, or the explicit Settings → Return to Earth command can replace membership. Returning to Earth keeps the same room name and receives a fresh pilot session. Solo transforms are not sent to the multiplayer API or the legacy cross-tab presence channel.

The in-memory backend supports pilots on **one running server process**. Multiple instances or serverless deployments require the existing Supabase multiplayer tables and server credentials in `lib/durableMultiplayerStore.js`. This change does not provision or validate a hosted Supabase instance. Production load, database write throughput and overlapping sessions for the same account require deployment-level testing before scaling beyond small groups.

## Visuals and verification

Planets use procedural surfaces, day/night lighting, atmospheric rims, ocean highlights and, in High mode, a separate cloud layer. Halcyon's rings have radial bands and a division. Instanced asteroids have deformed silhouettes, crater geometry and procedural mineral/grit textures. The fictional Drift comet has an icy nucleus, coma, dust plume and anti-solar ion tail. Local pulse hits produce brief rock sparks; rocks are not destroyed. Auto mode uses Performance settings on touch/mobile devices; manual quality is saved locally. Bloom and dense clouds are disabled in Performance mode.

Run `node --test tests/*.test.mjs`, `npm run build`, `node scripts/verify-api-routes.mjs`, and `APP_SMOKE_BASE_URL=http://127.0.0.1:3000 node scripts/verify-pages.mjs` against a running build. `APP_SMOKE_BASE_URL=http://127.0.0.1:3000 node scripts/verify-exploration.mjs` tests actual connect/state/disconnect routes with two independent guest cookie jars in a temporary room, then releases those sessions. Flight tests cover cruise convergence, safe viewing points, batch parity, replay rejection, server-time limits, room isolation and authenticated disconnects. Browser verification should include two independent guest contexts, movement visibility, room switching, solo isolation, reconnects, HUD shortcuts, text input and touch releases.

## Ship weapons

Pulses appear immediately in solo/shared flight. Shared shots are accepted only for a valid session, at most every 200 ms, using the authoritative ship position and a finite normalized aim vector. They travel at 64 u/s relative to the firing ship and expire after 2.2 seconds. Server clients cannot choose a projectile origin or claim hits. There is no PvP damage, asteroid destruction or score/progression reward for firing. Local rock-hit sparks are cosmetic; lower quality clients may render fewer distant rocks. Account-bound Prayer Seed data is never part of these packets.

Phone controls support simultaneous captured pointers. Releasing or cancelling one finger leaves other held controls active. Opening a panel, hiding controls, switching sessions or losing focus clears held flight inputs. Phone Auto quality bounds pixel ratio and debris density and disables bloom. Browser emulation validates interaction/layout, but physical iOS Safari and Android device performance still needs a device check.

## Distributed cosmic map

`lib/cosmicLayout.js` supplies static star, black hole and Dyson coordinates, shared by rendering, waypoints and gravity. Most cosmic anchors are ten times farther from spawn than the original layout; the Sun has its own distant global center. Solar body positions come from `lib/universeFlight.js` and live ephemerides. The nearby fictional worlds and account-bound Prayer Seed encounter retain their locations. The camera may change its rendering origin, but the ship's global position and multiplayer room remain unchanged.
