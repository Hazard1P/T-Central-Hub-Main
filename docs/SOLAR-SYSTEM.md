# Solar System flight in one universe

Launch `/system`, open **Explore**, choose **Solar System · Sun**, Earth, another planet, or the Earth GEO beacon, then **Cruise to destination**. Every destination is a physical position in the same universe. Manual thrust can reach the same places. There are no Solar entry buttons, planetary room namespaces, region transfers, teleportation or destination-driven ship resets. The old `/system/solar-system` URL redirects to `/system?destination=solar-earth`, which selects Earth as a normal waypoint and launches near Earth. Settings → Return to Earth explicitly respawns there; selecting other destinations never resets the ship.

The Sun sits at `[24000, 1600, 12000]`. Fictional stars, black holes, Dyson structures, Halcyon, Pelagos and The Drift occupy distant regions beyond the outer planets. New pilots start near Earth. The additional generated Shared Hub Star has been removed. The room name is solely the player's chosen multiplayer room. Pilots near Earth and pilots near spawn are members of that same room and share global positions, velocities and pulses. Switching a room or solo/shared mode is still an explicit session change.

## Real timing and one physical scale

Astronomy Engine **2.1.19** calculates geometric heliocentric positions at live UTC, including eccentricity, inclination, lunar motion and IAU body orientation. Earth's Greenwich direction includes sidereal rotation, precession and nutation. Planetary illumination follows the Sun direction. `/api/astronomy/time` provides uncached server UTC with a round-trip midpoint offset estimate, refreshed every five minutes; the UI clock hook falls back to device UTC when unavailable.

All Solar distances **and radii** use **4,000,000 world units per AU**. Earth has a mean radius of approximately 170.35 units, the Sun 18,601.87 units, and Neptune is about 120 million units from the Sun. The rendered frame is J2000 ecliptic `[x, z, -y]`, translated by the Sun's fixed world position. Earth, Jupiter and Saturn include equatorial flattening. Navigation positions and surface constraints use these global coordinates, with one-second ephemeris caching in flight calculations and more frequent rendering updates.

Earth GEO is an ideal circular equatorial geostationary orbit, with a **86,164.0905-second** period, radius about **42,164.170 km** and altitude about **35,786.033 km**. The zero-longitude beacon and ring follow Earth's rotation and are reachable by ordinary flight. This is an illustrative orbital marker, not a live satellite feed.

## Long-distance flight and rendering

Automatic deep-space assist increases thrust and speed away from objects, then reduces permitted speed near them. Cruise uses ordinary bounded control vectors, follows moving planetary waypoints and bends its course around intervening bodies. It never directly sets the player's position. Normal slow render frames are integrated in small substeps instead of discarding elapsed flight time; a 0.25-second catch-up cap prevents background-tab time jumps. The shared server applies the same physics and surface constraints, rejects replayed inputs and budgets simulation time against elapsed server time. The finite numeric guard is ±1 billion units on each axis; it encloses the outer Solar System, well beyond the old ±160-unit play area.

The camera rebases the render origin in 1,000-unit increments. Physics, waypoints, account state and multiplayer coordinates do not change during rebasing. Near objects render at their physical positions and scale. Beyond 20,000 units, celestial geometry uses an angular-size level of detail projected into the camera's visible range; navigation still uses its true distance. This bounds depth-buffer precision and phone GPU work. Far-body eclipse/occlusion accuracy is not guaranteed by this rendering approximation.

Pulses inherit the authoritative ship velocity plus their muzzle velocity, so cannons remain coherent during deep-space travel. Their owner, cooldown and launch position remain server controlled. Firing does not award progression or accept client hit claims.

## Fidelity and validation

This is an explorable game using astronomical ephemerides, not a spacecraft navigation ephemeris. Flight uses assisted thrust and drag rather than realistic orbital mechanics or station-keeping. Conservative spherical surface constraints prevent planetary penetration; landings and terrain are not modeled. Astronomy Engine targets roughly arcminute accuracy, using geometric positions without light-time delay or aberration; its UTC/TT and estimated ΔT model is not a precision UT1 source.

Earth/Moon maps are bundled locally; see [texture attribution](../public/textures/solar-system/ATTRIBUTION.md). Other surfaces, storms, solar granulation, fictional stars and comet/debris details are illustrative. Eclipses, ring shadows, live weather/activity, other moons and a measured star catalog are not modeled. Public shared flight on multiple server instances still requires the existing Supabase tables and configured server credentials.

`node --test tests/*.test.mjs` covers ephemerides, physical scale, GEO, continuous travel to Earth, far-coordinate camera arithmetic, shared flight past the former bounds, obstacle avoidance, account privacy and weapon validation. `node scripts/verify-solar-system.mjs` checks server UTC and legacy entry redirects against a running build. Browser checks should verify one canvas, one room/session token during flight, no spawn resets, moving planetary approaches, distant weapon rendering, and mobile simultaneous steering/thrust/fire.

Sources: [Astronomy Engine](https://github.com/cosinekitty/astronomy), [JPL approximate elements](https://ssd.jpl.nasa.gov/planets/approx_pos.html), [NASA planetary facts](https://nssdc.gsfc.nasa.gov/planetary/factsheet/), [IAU rotation reference](https://astropedia.astrogeology.usgs.gov/download/Docs/WGCCRE/WGCCRE2015reprint.pdf).

See [UNIVERSE-SCALE.md](UNIVERSE-SCALE.md) for spawn, return and fictional body dimensions.
