# Our Solar System

Use **Play → Explore our Solar System**, or select **Solar System → Enter our Solar System** in the flight Explore panel. The detailed view lives at `/system/solar-system`. It starts at Earth in live UTC. Drag to orbit the camera, scroll/pinch to zoom, and use the destination strip to approach another body. The Sun, eight planets, Earth's Moon and dwarf planet Pluto are included.

## What follows real astronomy

- Astronomy Engine **2.1.19** calculates geometric heliocentric positions, in AU, at the selected UTC instant. The Moon uses a geocentric lunar ephemeris plus Earth's heliocentric position. Inclination, eccentricity and unequal orbital periods come from those calculations, rather than circular paths with decorative animation speeds.
- IAU rotation-axis models provide the body orientations and spins. Earth's Greenwich direction uses the library's observer-vector calculation, including sidereal rotation, precession and nutation. The rendered sphere's prime meridian aligns with the texture's zero longitude. Day/night illumination comes from the Sun's actual direction relative to each body.
- The main `solar_system` hub anchor uses a fixed Sun profile (1 solar mass, radius and luminosity; G2V; 5772 K) and eight named planets. Its miniature samples the same ephemeris, with a **uniform 0.2 hub units per AU** for orbital positions. Enlarged navigation dots identify worlds in that miniature; they are not their physical radii. Other fictional systems and the Prayer Seed encounter remain in the surrounding hub.
- `/api/astronomy/time` supplies uncached server UTC. Clients estimate clock offset using the request round-trip midpoint and refresh every five minutes. If synchronization fails, the interface identifies its device-clock fallback. Independent clients calculate the same geometry for the same instant. No ephemeris API key or external runtime service is required.
- Time previews use elapsed monotonic time, not animation-frame counts. Pause, 1×, one minute/hour/day per second, and 30 days per second are available. Custom UTC dates and playback are bounded to **1700–2200**; playback pauses at a boundary. Returning to live UTC discards the preview. Time previews are local to the viewer and do not change shared flight or account timestamps.

The scene uses a Sun-centered J2000 mean ecliptic frame, rendered as `[x, z, -y]` to keep a right-handed Y-up coordinate system. All physical distances and body radii use the same AU scale. For a close approach, the selected body's instantaneous position becomes the scene origin, preserving floating-point precision without changing relative distances. Camera framing accounts for screen aspect ratio. The overview can optionally enlarge body radii 100× (except the Sun); approaching a body always returns to physical scale. Orbital paths are sampled ephemeris guides, not force-integrated trajectories.

## Geosynchronous and geostationary orbit

The **Earth GEO** destination demonstrates an ideal circular, equatorial **geostationary** orbit, a special case of geosynchronous orbit. Its period is **86,164.0905 seconds**, one sidereal day, rather than 24 hours. With Earth's gravitational parameter `398600.4418 km³/s²`, Kepler's circular-orbit relation gives a radius of approximately **42,164.170 km**, or **35,786.033 km** above the WGS84 equator. The marker stays over the selected longitude as Earth turns. A slider chooses that longitude; zero inclination and eccentricity are explicit in Details.

This is an illustrative orbital marker, not a real satellite feed. Planetary orbits around the Sun are not geosynchronous. This view does not simulate station-keeping, orbital perturbation forces on spacecraft, launches, collisions or a controllable spacecraft trajectory.

## Fidelity and sources

This is a time-synchronized astronomical visualization, **not an exact reconstruction of every object or a spacecraft navigation ephemeris**. Astronomy Engine's approximate analytic/numerical ephemerides target roughly arcminute accuracy; consult its own validation and limitations. Positions are geometric at a common instant, without light-time delay or aberration. UTC/TT conversion and estimated ΔT use the library's time model; the server clock is not a precision UT1 source.

Earth and Moon use bundled image maps from the Three.js examples; see [texture attribution](../public/textures/solar-system/ATTRIBUTION.md). Other surfaces, storms and ring albedo are procedural illustrations. Radii are mean volumetric radii, with flattening applied to Earth, Jupiter and Saturn. The Moon has its calculated orientation; Earth/Moon eclipses, ring shadows, real-time weather, terrain, other moons, asteroids, comets and a measured star catalog are not modeled. The Sun's map does not show live solar activity.

References:

- Astronomy Engine and validation: https://github.com/cosinekitty/astronomy
- JPL approximate elements (independent coarse test reference): https://ssd.jpl.nasa.gov/planets/approx_pos.html
- NASA planetary fact sheets: https://nssdc.gsfc.nasa.gov/planetary/factsheet/
- IAU rotation-axis reference used by Astronomy Engine: https://astropedia.astrogeology.usgs.gov/download/Docs/WGCCRE/WGCCRE2015reprint.pdf

`node --test tests/solar-system.test.mjs` checks the real body catalog, independent J2000 reference positions, elliptical/inclined geometry, lunar distance, physical scale, deterministic UTC positions, orthonormal body axes, sidereal timing, GEO radius and longitude, monotonic playback and range limits. `node scripts/verify-solar-system.mjs` checks the running application's UTC endpoint and entry routes.
