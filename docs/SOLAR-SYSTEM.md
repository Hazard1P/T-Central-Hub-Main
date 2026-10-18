# Solar System flight

Launch the simulation, select **Explore → Solar System → Cruise to destination**, or fly toward the Solar System freely. Crossing its 13-unit approach boundary automatically continues into Earth-local ship flight. There is no separate Solar System entry button. This is the playable ship simulation at `/system?region=solar&body=earth`, using the existing canvas, account, weapons and touch controls. The old `/system/solar-system` address redirects into flight. **Explore** warps between the Sun, eight planets, Earth's Moon and Pluto; **Universe** returns to the surrounding universe. Warp changes local region and respawns the ship while keeping the account and base room choice. There is no separate orbit-camera page.

Move the mouse to steer; hold click or V to fire. WASD/arrows thrust, Space/R and Shift/F move vertically, Ctrl boosts and X brakes. Escape releases pointer lock. On phones, drag open space to steer while holding the flight pad and Fire with separate fingers. **Cruise to [planet]** approaches a viewing point outside its surface. Controls, progression and the hidden account encounter in the hub use the same lifecycle throughout travel.

## Astronomy and flight scale

Astronomy Engine **2.1.19** calculates geometric heliocentric positions in AU at live UTC, with lunar geocentric position added to Earth's position. IAU rotation-axis models supply body orientations and spins. Earth's Greenwich direction includes sidereal rotation, precession and nutation. Day/night illumination follows the actual Sun direction. The distributed main map places the Sun at `[70, 18, 42]`; its miniature samples the same ephemeris at 0.2 hub units per AU, with enlarged navigation dots. Its Sun profile uses one solar mass, G2V classification and 5772 K.

`/api/astronomy/time` supplies uncached server UTC. Clients estimate offset using round-trip midpoint timing and refresh every five minutes, identifying device-clock fallback when needed. Flight uses live time on all clients; the former standalone date-preview controls are removed. No external ephemeris service or API key is needed.

Each planet is a local flight region with its mean radius mapped to **8 flight units**. One unit therefore represents `radiusKm / 8` km; the Settings panel shows the conversion. The origin follows the selected planet, in a co-rotating frame that puts the Sun along negative Z. Body axes, other bodies and lighting transform together. Distances and radii share the same linear scale nearby; distant bodies project onto the sky at their physical angular sizes to preserve numerical precision. Stars are decorative. Long-distance travel uses warp, so this is not a single continuous AU-scale spacecraft trajectory.

Flight uses bounded thrust and drag, with orbit assist replacing the fictional hub gravity field. A 9-unit surface boundary prevents entry into the mean spherical planet. It is a gameplay boundary rather than terrain or a landing model. The rendered equatorial flattening is small enough to remain within it. Debris targets in these local regions are fictional scenery, not catalogued objects or real near-planet asteroid populations.

Shared pilots meet only when both base room and planetary region match. Region room names include a hash of the entire base room name. Transitioning disconnects old membership and joins the new region without remounting the game canvas. Returning to the hub respawns there; previous local transforms are not retained.

## Earth GEO

Earth includes an ideal circular, equatorial **geostationary** orbit and beacon at zero longitude. This special case of geosynchronous orbit uses a **86,164.0905-second** sidereal day and Earth's gravitational parameter `398600.4418 km³/s²`. Radius is approximately **42,164.170 km**, or **35,786.033 km** above the WGS84 equator. Its position follows Earth's UTC rotation and remains over the same longitude. Fly around Earth to find the beacon; its line and marker are illustrative, not a satellite feed. Planetary orbits around the Sun are not geosynchronous.

## Fidelity and sources

The geometry is time synchronized, but the game is not an exact reconstruction of every object or a spacecraft navigation ephemeris. Astronomy Engine targets roughly arcminute accuracy. Positions are geometric at a common instant without light-time delay or aberration; UTC/TT and estimated ΔT use the library's model. Server UTC is not precision UT1.

Earth and Moon use bundled image maps from the Three.js examples; see [texture attribution](../public/textures/solar-system/ATTRIBUTION.md). Other surfaces, storms, solar granulation and ring albedo are procedural illustrations. Mean volumetric radii are used, with flattening for Earth, Jupiter and Saturn. Eclipses, ring shadows, live weather/solar activity, other moons, measured star positions, station-keeping and spacecraft orbital perturbations are not modeled.

References:

- Astronomy Engine and validation: https://github.com/cosinekitty/astronomy
- Independent coarse J2000 reference: https://ssd.jpl.nasa.gov/planets/approx_pos.html
- NASA planetary fact sheets: https://nssdc.gsfc.nasa.gov/planetary/factsheet/
- IAU rotation reference: https://astropedia.astrogeology.usgs.gov/download/Docs/WGCCRE/WGCCRE2015reprint.pdf

Run `node --test tests/*.test.mjs` for ephemerides, axes, sidereal timing, GEO, flight boundaries, region isolation, pulse sweeping and server weapon validation. `node scripts/verify-solar-system.mjs` checks live UTC and entry redirects against a running build. Browser checks must include same-canvas hub/planet travel, shared room transitions, mouse steering, pulse firing and simultaneous touch controls in portrait and landscape.
