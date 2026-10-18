# Playable universe

Launch `/system` to fly. The default HUD has a toolbar and a compact speed, waypoint distance and bearing readout. Explore, Pilots and Settings open one panel at a time; `H` hides the HUD and `M` opens destinations. Sign in on the homepage; private discoveries belong to the account collection at `/profile`.

## Exploration

The main Solar System now uses real planetary ephemerides. Launch the simulation and cruise or fly toward the Solar System destination. Its approach boundary automatically transfers the ship into Earth-local flight in the same canvas; there is no separate entry button. See [SOLAR-SYSTEM.md](SOLAR-SYSTEM.md) for planet-local flight scale, live UTC and Earth GEO.

- Fly with WASD/arrows, Space/R to rise, Shift/F to descend, Ctrl to boost and X to brake. Move the mouse to steer without holding a button; hold click or V to fire pulse cannons. Clicking optionally locks the pointer; Escape releases it. Touch devices have independent thrust, boost and Fire holds plus drag steering.
- Select a destination, then **Face destination** to orient without moving, or **Cruise to destination** to travel using bounded thrust. Steering or manual thrust cancels cruise. **Cancel cruise** returns manual control; automatic braking is enabled initially and can be changed in Settings.
- Cruise approaches a viewing point outside a planet, ring system or structure. Outer-world viewing points stay within the existing simulation bounds. The universe is a bounded space, not an infinite or surface-landing simulation; Solar regions enforce a safe planetary surface boundary. Other object collisions are not modeled.
- Discoveries record proximity to the selected landmark. Selecting a distant landmark does not count as a visit. Existing progression hydration and persistence remain in place.
- Halcyon, Pelagos and The Drift are defined in `lib/exploration.js`; rendering and navigation share those landmark definitions. Hub anchors and owned solo-world nodes are also selectable. Sealed system controls and unused relay actions are omitted.

## Shared flight

The hidden account-bound encounter is documented separately in [PRAYER-SEEDS.md](PRAYER-SEEDS.md), including its Unix epoch binding, account privacy and database migration.

Choose **Pilots → Shared universe**, enter the same room name on each device, or copy the invite link. Room names allow 1–64 letters, numbers, dashes and underscores. A room name is a rendezvous address, not an access-control secret. Guests can fly together. Pilots appear as ships, and the roster can set a waypoint to a pilot's last shared location.

`useSharedFlight` keeps one network request in flight and polls 250 ms after a successful response. Errors back off, expired sessions rejoin, and slow requests time out. Guest identity comes from an opaque HttpOnly browser-session cookie; a public roster ID cannot be supplied to claim another guest's session. HUD telemetry publishes at 10 Hz independently of rendering. Each request sends unacknowledged input frames, and the client replays remaining frames after a server acknowledgment. Both in-memory and durable stores use `advanceFlightBatch`, which bounds simulated time by elapsed server time, rejects invalid frame durations and does not apply an acknowledged frame twice. The server never accepts a client position as authoritative.

Solar System travel keeps the same canvas, ship controls, account and base room choice. Each planet uses a deterministic region room derived from the full base room name; choose the same planet to meet. Warp releases the old region session and joins the new one. Returning to the hub starts at its spawn. Switching rooms, leaving the simulation or choosing solo flight releases the old session. Solo transforms are not sent to the multiplayer API or the legacy cross-tab presence channel. Rejoining starts from the shared server position rather than transferring a solo-world transform.

The in-memory backend supports pilots on **one running server process**. Multiple instances or serverless deployments require the existing Supabase multiplayer tables and server credentials in `lib/durableMultiplayerStore.js`. This change does not provision or validate a hosted Supabase instance. Production load, database write throughput and overlapping sessions for the same account require deployment-level testing before scaling beyond small groups.

## Visuals and verification

Planets use procedural surfaces, day/night lighting, atmospheric rims, ocean highlights and, in High mode, a separate cloud layer. Halcyon's rings have radial bands and a division. Instanced asteroids have deformed silhouettes, crater geometry and procedural mineral/grit textures. The fictional hub comet has an icy nucleus, coma, dust plume and anti-solar ion tail. Local pulse hits produce brief rock sparks; rocks are not destroyed. Auto mode uses Performance settings on touch/mobile devices; manual quality is saved locally. Bloom and dense clouds are disabled in Performance mode.

Run `node --test tests/*.test.mjs`, `npm run build`, `node scripts/verify-api-routes.mjs`, and `APP_SMOKE_BASE_URL=http://127.0.0.1:3000 node scripts/verify-pages.mjs` against a running build. `APP_SMOKE_BASE_URL=http://127.0.0.1:3000 node scripts/verify-exploration.mjs` tests actual connect/state/disconnect routes with two independent guest cookie jars in a temporary room, then releases those sessions. Flight tests cover cruise convergence, safe viewing points, batch parity, replay rejection, server-time limits, room isolation and authenticated disconnects. Browser verification should include two independent guest contexts, movement visibility, room switching, solo isolation, reconnects, HUD shortcuts, text input and touch releases.

## Ship weapons

Pulses appear immediately in solo/shared flight. Shared shots are accepted only for a valid session, at most every 200 ms, using the authoritative ship position and a finite normalized aim vector. They travel at 64 u/s and expire after 2.2 seconds. Server clients cannot choose a projectile origin or claim hits. There is no PvP damage, asteroid destruction or score/progression reward for firing. Local rock-hit sparks are cosmetic; lower quality clients may render fewer distant rocks. Account-bound Prayer Seed data is never part of these packets.

Phone controls support simultaneous captured pointers. Releasing or cancelling one finger leaves other held controls active. Opening a panel, hiding controls, changing region or losing focus clears held flight inputs. Phone Auto quality bounds pixel ratio and debris density and disables bloom. Browser emulation validates interaction/layout, but physical iOS Safari and Android device performance still needs a device check.

## Distributed cosmic map

`lib/cosmicLayout.js` defines the shared coordinates for the main Sun, four fictional stellar systems, server black holes, three Dyson spheres and outer black holes. They span over 200 units horizontally and 100 vertically, with a clear spawn region. The Synaptics dock retains its relative offset from its sphere. Relay nodes occupy broad three-dimensional shells. The shared epoch star sits in its own region, away from the main Sun. Rendered nodes, map assets, destinations and static gravity sources resolve the same coordinates; room seeds vary gravity mass slightly without moving the sources. The account-bound Prayer Seed location remains near Halcyon.

The Solar System boundary changes local scale for close planetary flight. It does not navigate away or create another canvas. Planet-to-planet warp and returning to the wider Universe remain explicit navigation choices.
