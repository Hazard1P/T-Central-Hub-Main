# Shared universe physics

The playable universe uses one renderer-independent flight core, shared by the authoritative WebSocket service, client prediction/replay, the legacy HTTP adapter and the older THREE/graph ship interfaces. `lib/physics` holds mechanics, collision and body APIs; `lib/simCore/stepFrame.js` connects them to the existing world, controls and flight-assist tuning.

## Units and sources

- World distance is `SOLAR_UNITS_PER_AU = 4,000,000` units per AU. `KM_PER_UNIT = 149597870.7 / 4000000`; time is seconds. Positions and velocities retain double precision during integration. Network/display rounding occurs outside the solver. Stored prediction controls and time steps retain their original numeric precision.
- `physics/world.js` supplies standard gravitational parameters for the Sun, eight planets, Moon and Pluto, converted from km³/s² to world units³/s². Their positions remain driven by the existing Astronomy Engine UTC ephemerides, cached at the existing one-second orbital resolution. Ships experience these fields; the old synthetic `solar_system` mass is excluded to avoid a second Sun.
- The four generated deep-space stars reuse `stellarPhysics.createStellarProfile`. Their stable profile is shared by rendering and server source catalogs; their gravity uses the generated solar mass ratio. These are fictional stars, not observed astronomical systems.
- Existing black-hole and Dyson game masses retain the shared game gravity parameter, 0.22. Their visible horizons, energy, spin, epoch/entropy and intelligence effects remain illustrative game systems. Rendered horizon size is not inferred to be a physical Schwarzschild radius.
- `physicsEngine`, `gravityEngine` and `shipEngine` are compatibility facades. They delegate forces/integration to the shared engine; the old 60-unit boundary, separate 18.5 gravity constant and alternative movement integrators no longer govern their ship movement.

## Flight and time

The live service chooses fixed 50ms ticks. RK4 integrates each flight step in substeps no larger than 1/60 second. It prepares one world frame per room/tick and reuses it for all pilots. Public pose/projectile snapshots are immutable and cached between ticks; interest distances are calculated once per recipient instead of repeatedly during sorting. Explicit `utcMs` keeps integration independent of the machine's wall clock when replaying a known epoch. Server snapshots advertise `physicsVersion` and `physicsUtcMs`; client reconciliation replays against the supplied server epoch. The scene's local prediction uses its synchronized Solar clock. A bounded four-second ephemeris cache avoids rebuilding alternating prediction/render epochs. Normal reconciliation uses the latest snapshot once per animation frame; death and respawn corrections remain immediate.

There is no ambient vacuum drag. Disabling automatic braking allows inertial coasting within the travel envelope. `lib/flightTuning.js` supplies one balanced setup for solo flight, shared flight, cruise and prediction: local thrust 12 u/s², 20 u/s precision speed target, 1.75 maximum boost/control magnitude and the existing global 4,000,000 u/s safety cap. Acceleration eases as velocity approaches the current target. Precision, Transit and Deep space labels describe a continuous assist curve, not separate scenes or instantaneous travel modes.

Every obstacle contributes a continuous clearance envelope; the most conservative thrust and speed targets apply, preventing jumps when the nearest reference changes between a planet and mining field. Approaches use bounded braking rather than clamping velocity/displacement to a suddenly lower regional speed. Only the global safety cap, world boundary and actual swept collisions can impose hard limits. Brakes retain a speed-dependent force budget when leaving fast travel, bounded by maximum assisted thrust; they do not collapse to the precision manoeuvring budget while the ship is still moving quickly. Cruise accounts for both stopping distance and controller response time. These are gameplay assists, not realistic propulsion or energy accounting.

Weak-field gravitational clock-rate and special-relativistic diagnostics use the physical speed of light after unit conversion. Unsupported strong-field/superluminal states return no proper-time estimate. These diagnostics do not change orbital UTC, account epochs, Prayer Seeds, financial records, mining cooldowns, shields or respawn timers. Deep-space assist is not a relativistic propulsion simulation.

## Contacts, weapons and resources

- Celestial surfaces and supplied asteroid/structure colliders use swept sphere contacts, conservative oblate-body padding and tangential sliding. Each tangent remainder is swept again, up to eight contacts; exhausting that budget stops at the last contact. Deep-space sphere sweeps use closest-approach geometry to retain small-target precision on billion-unit segments. Fast motion cannot simply skip a single surface between endpoints. These are spherical collision proxies, not mesh-accurate terrain or rings.
- Live pilots use deterministic pair ordering, swept broad-phase checks and mass-weighted impulses with restitution 0.15. The game currently assigns pilots equal mass and a shared 3.2-unit contact radius for both ship contacts and surface clearance. Cargo does not yet change that mass. Contacts deflect ships without adding ramming damage or combat credit rewards. Client prediction is reconciled to the server's peer-contact result.
- Pulses preserve their existing inherited ship velocity, 64-unit/s relative speed and 2.2-second lifetime. They are gameplay projectiles, not photons. `createShipPulse` supplies the same four-unit muzzle offset and inherited velocity to local prediction, the live service and legacy adapters. Local impact effects and remote visual extrapolation respect the same celestial collision proxies. Their hit checks use the same sphere sweep primitive and account for a target's motion within the server step. Future-dated shots do not move backward during catch-up ticks.
- Mining ray selection uses first surface entry rather than center distance and rejects celestial obstruction with the shared contact solver. Mining and Earth service geometry are evaluated at the trusted pilot snapshot epoch; cooldowns, transaction timestamps and ore regeneration still use current server time. The mining beam retains its independent instantaneous 180-unit interaction range; pulse travel is not the transaction trigger.
- Shared asteroid integrity, per-hit ore, depletion, Earth delivery, repairs and upgrades retain their authoritative economy/system rules. Mining rocks are resource interaction volumes; depletion is held in Postgres, not in the game worker. They do not become invisible solid obstacles after mining. Distant decorative asteroids and comet tails/tumbles remain presentation; they are not an active N-body debris simulation.
- Private stellar colliders enter solo physics only. Account data and private seed contents are not included in public physics snapshots.

## Extension APIs

```js
import { createPhysicsFrame } from '../lib/physics/world.js';
import { stepFrame } from '../lib/simCore/stepFrame.js';

const utcMs = Date.UTC(2026, 9, 22);
const frame = createPhysicsFrame({ utcMs, gravitySources, extraColliders });
const next = stepFrame({ position, velocity, controlVector,
  dt: 0.05, physicsFrame: frame });
```

`sampleField` exposes acceleration, potential, escape speed, radial tidal gradient and bounded relativity diagnostics. A source can supply a gravitational parameter `mu` directly; world-frame descriptors also accept `massKg`, converted with the SI gravitational constant. `schwarzschildRadius` uses the shared world speed of light and a gravitational parameter. `rk4Step` provides uncapped translation for scientific orbital/body tests.

`stepRigidBody` adds an extension API for force/mass translation, principal-axis inertia, Euler angular dynamics and normalized quaternion attitude. It uses RK4 translation/angular velocity and midpoint attitude substeps no larger than 1/120 second, with a maximum 0.2-second call. Forces use mass·u/s², torque uses mass·u²/s² in body principal axes. Use it for future physical debris or cargo bodies; live pilot attitude remains controlled by the existing mouse/touch steering. `resolveBodyPairs` supplies the shared sphere impulse solver.

This is a Newtonian game engine with bounded diagnostic relativistic approximations. It does not solve general relativity, full mutual N-body planetary evolution, fluid atmospheres, deformable bodies or mesh contacts. Solar ephemerides, fictional presentation and authoritative gameplay systems deliberately retain their distinct roles.

## Verification and deployment

Run `npm run verify:simulation` for the full unit suite, API route exports and production build. The Node 24 GitHub Actions simulation job runs the same command on pull requests and pushes to main/development branches. Numerical tests check inverse-square acceleration, Earth surface gravity, GEO period, ten revolutions of orbital energy/angular-momentum stability, rigid-body force/torque, momentum conservation, tunneling, explicit-time replay, tiny planetary accelerations and legacy/current adapter agreement. Server tests cover swept moving targets, ship contacts, combat authority and respawn continuity. The original surface test now pins its UTC epoch so it cannot compare the Earth on opposite sides of a one-second ephemeris update.

Deploy the matching website and persistent WebSocket service together. This engine change adds no database schema or dependencies; previous economy migrations remain required. The game service remains a single process with the existing 128-player admission cap. Admission is not a production performance guarantee; profile the actual hosting and clients before choosing a public population limit.

## Compatibility

`PHYSICS_VERSION` is `universe-physics-3`. Signed website tickets, browser joins, server joins and snapshots must agree. The worker rejects mismatches before admission or replacement; the browser checks both the connect response and worker packets before using their transforms, clears stale shared state on disconnect and stops automatic retries on a version mismatch. `/healthz` and lobby responses expose the version for deployment inspection. A stale browser should reload; a persistent mismatch needs matching website/game-service deployment.

## Local validation snapshot

The v2 integration pass passed 150 automated tests and a production build. Checks verified explicit handler exports in 52 API route files, 26 page routes and guest administration guards, and the authenticated mining/delivery cycle, including receipt replay protection and private account records. Fixtures use synthetic credentials and a local database; these checks do not verify live OAuth, payment or hosting configuration.

Chromium checks verified the Settings instruments, vacuum coasting, keyboard braking, two-player combat/Earth respawn and native touch thrust/brake/fire. Rendered screenshots at 320, 390 and 844 pixels showed controls within the viewport, clear of the flight strip, with no page or shader errors. The software graphics driver stalled input beyond the service's existing 250ms stale-input safety threshold. Timing assertions therefore disabled WebGL draw calls in the external test harness, while keeping scene updates, physics, DOM input and the real WebSocket service active; screenshots used normal rendering. This validates control plumbing, not physical phone frame rates. A separate browser check confirmed the incompatible-release message and that it issued only one connect request rather than retrying. Test representative hardware before release.

The earlier v1 cached-snapshot load run admitted 128 synthetic WebSocket pilots, rejected overflow and delivered snapshots continuously for 30.07 seconds. It measured 19.5 simulation steps/second, 159–163 snapshots per pilot (about 5.3/second) and 443.39 MiB aggregate wire traffic. Before caching, the same local scenario measured 16.8 simulation steps/second and about 4 snapshots/second. Both synthetic clients and the game service run in one Node process. The final result remains below the 20 Hz / 10 Hz targets and is not approval of production hosting capacity.

The v2 follow-up load check used the versioned join protocol, admitted 128 pilots, rejected overflow and sustained 19.5 simulation steps/second over 5.28 seconds, with 32–36 snapshots per pilot and 95.53 MiB aggregate wire traffic. This short loopback check retains the hosting and hardware limitations above; it is not a production population certification.

## Balanced layout and flight (v3)

Outer landmark, stellar, Dyson, black-hole, relay and private-region centres contract by a factor of 0.8 around the Sun. World bounds are ±800,000,000 units. The physical Solar System keeps 4,000,000 units/AU, body sizes, UTC orbits and Earth spawn. Fictional body sizes stay large; docking offsets retain their full clearance. Stable destination/account identifiers and saved progression are retained.

At the fixed 2026-10-26 UTC test epoch, 50ms-step cruise from the same Earth spawn to Synaptics measured 118.70 seconds before and 104.95 seconds after the change, across approximately 207.90 million versus 167.08 million units. The moving mining-field approach measured 17.95 versus 18.60 seconds; the modest extra approach time allows gentler braking. These are reproducible simulation timings for those routes, not universal journey guarantees. The final field approach also supports settling within mining range of a moving asteroid.

The v3 release passed 159 automated tests, API handler-export checks and the production build. Browser checks exercised shared combat/respawn, coasting, keyboard and native touch braking/fire, 320/390/844px controls, solo private replicas and the new travel instruments. The timing assertions retain the software-rendering limitation documented above. The authenticated mining/delivery/replay test and all 26 page/guest-admin checks passed. A five-second synthetic loopback run admitted 128 pilots, rejected overflow and measured 19.9 simulation steps/second over 5.03 seconds, with 43–45 snapshots per pilot and 129.58 MiB aggregate wire traffic. Production hosting and physical phone performance remain unverified.
