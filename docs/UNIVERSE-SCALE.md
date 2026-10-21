# Solar starting area and deep-space scale

The physical Solar System uses **4,000,000 world units per AU**, twice the previous scale. Every real body, separation, planetary ring and GEO reference uses that same conversion. Astronomical size ratios, orientation, UTC ephemerides and geostationary timing are preserved. No separate Solar System scene or travel room is introduced.

New pilot sessions and the local launch start on Earth's illuminated side, approximately 3.3 Earth radii from its centre, with small identity-specific offsets to separate ships. Earth is the default selected destination. **Settings → Return to Earth** stops cruise and resets solo flight; shared flight first releases its authenticated pilot session and rejoins the same room at the server's Earth spawn. A failed release displays an error rather than claiming a successful return. Recenter view only resets the camera controls.

The additional generated Shared Hub Star and its routes are removed. The Sun remains the replica's only central star. Fictional stars, planets, black holes, Dyson spheres, stations, private systems and the Drift are in distant regions of the same coordinate frame, beyond the outer planetary system. Private replicas are spaced apart rather than stacked at the starting point.

`lib/celestialScale.js` defines fictional geometry scale, solid surfaces, ring/disk envelopes and safe viewing distances. Rendering, route planning and flight clearances share these dimensions. The Synaptics dock sits outside its enlarged Dyson structure. Stations, the private map frame and the GEO marker are enlarged too. Fictional object dimensions are gameplay scales, not claims about real astronomical measurements.

`ProjectedCelestial` preserves the apparent angular size of distant objects within the camera's render range. It changes rendering only; flight, collisions, multiplayer positions and navigation retain full global coordinates. The same body dimensions apply at both graphics quality levels and on phones.

The textured rock and comet field is located at the Drift destination, using local rendering coordinates and global weapon collider coordinates. The hidden Prayer Seed discovery follows Halcyon's viewing envelope; existing account-bound seed records are retained.

Verification includes unit checks for scale, ring clearance, docking separation, UTC-dependent Earth spawns, private-body obstacles, cruise routing and shared input replay. Browser checks cover launch, Earth spawn, flight selection, return, both graphics settings and phone controls. Provider-backed durable multiplayer still requires the configured production database; local browser checks use the development room store.

A real local browser flight traversed from Earth to the Synaptics Dyson region in the same room. Controlled starting positions were also used for repeatable close-up captures at the final viewing envelopes; those fixtures are outside the application repository.
