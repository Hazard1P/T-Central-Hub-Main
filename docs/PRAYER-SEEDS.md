# Account-bound In-Prayer-Intelligence

The quiet signal is an unlisted relic near Halcyon's approach point, at `[18.7, 8.3, 60]`. It becomes visible within 23 units. Within 5 units, listen with **E** or the contextual touch button. It is deliberately absent from Explore, initial HUD labels and destination search. Opening the encounter cancels cruise, clears flight input and applies braking. Writing never becomes a movement command.

Players choose their own prayer, intention or thought (1–320 characters). Saving also captures the game flight signature. Steam and Google sessions are resolved on the server; request-supplied owner IDs, intelligence IDs and timestamps cannot select ownership. Guests may discover the relic and sign in but cannot bind a seed until authenticated. A client position check gates this cosmetic discovery; it is not an anti-cheat proof of flight.

Each authenticated provider/account has one stable `account_cyber_intelligence` identity. All its seeds reference that identity and its account key, independent of room, lobby mode, browser and flight session. This references the existing `player_accounts(provider, account_id)` key, including legacy Steam records. Signing into both providers does not merge two accounts; the existing session resolver gives Steam precedence.

The server records Unix epoch **seconds**, a matching UTC timestamp and the existing epoch/Dyson anchor at save time. It hashes the account, intelligence ID, seed ID, epoch, written text and game signature into a SHA-256 content binding. This hash is not a password, authentication token or external notarization. Repeating a request returns its original immutable seed instead of inserting another one. A short per-account cooldown reduces accidental repeated submissions.

`GET /api/universe/prayer-seeds` returns only the verified account's collection; `POST` binds a discovered seed. Both are private and uncached. The universe session returns only that account's seed count, never its written text. Neither seed text nor cyber-intelligence IDs enter multiplayer snapshots or presence broadcasts. `/profile` shows the private collection, identity, Unix times and inspectable bindings. The latest 144 seeds are displayed, with the total retained count.

The previous encrypted Steam cookie is recovered on collection access, only when its signed owner and private scope match the current Steam account. Its original planting time is retained, with a `legacy-cookie` flight marker. Migration request IDs make repeated imports harmless. The cookie is left intact so other account entries are not lost.

## Deployment

Apply `supabase/migrations/20261018_account_prayer_seeds.sql` after the existing account migrations. Configure `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and the existing `SESSION_SECRET` on the hosting service. RLS is enabled, browser roles have no table access, and the server's service-role client handles account-filtered reads and inserts. No browser-only or anonymous Supabase fallback is used for private seeds. Account deletion cascades through intelligence and seed records.

Without durable database configuration or the migration, production returns **503** and the UI preserves the draft for retry. Development alone can use an atomic JSON file, explicitly labeled local in the UI; `PRAYER_SEED_DATA_DIR` can place it outside the checkout. Do not use local development data as hosted account persistence.

`node --test tests/prayer-seeds.test.mjs` checks ownership, provider isolation, epoch anchoring, discovery bounds, persistence across restart, retry behavior and failed storage. `scripts/verify-prayer-seeds.mjs` additionally exercises real encrypted sessions against a local development server using a test-only shared session secret.

## Uploaded solution references

Reviewed the supplied `<[SynapticSystems.Solutions]> 3.zip` as reference material. `GenesisEcho_Create_Profile.html` contributes the CyberSeed identity/sequence pattern (LUX, VIBRA, MTR, AEON, KYR, OMNI, ∆Ψ), user-chosen text, timestamp and SHA-256 signatures. `Cyberseed.json` / `Local_CyberSeed.json` contribute stable ownership and time anchoring concepts. Those JSON examples are not valid importable JSON as supplied; no hard-coded personal identity, image, location or device identifiers were imported.

The implemented cyber-intelligence is account-associated application data. The archive's neural, biometric and spiritual fields are not measurements available to this game. Stored seed content comes from the player's explicit text entry and game simulation context; archive scripts are not executed or connected to external systems.
