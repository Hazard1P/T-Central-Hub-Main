# Multiplayer Progression Rules

## Integration audit summary

Current multiplayer progression now bridges these surfaces:

1. `app/api/player/progression/route.js`
   - Remains the canonical read/write API for full snapshots.
   - Multiplayer flows now persist through the same `persistPlayerProgression` path, so XP/level math stays centralized in `lib/accountProgression.js`.
2. `lib/accountProgression.js`
   - Defines trigger rewards, per-session caps, cooldowns, and dedupe tracking (`multiplayerMeta.processedEventIds`).
   - Exposes `applyMultiplayerProgressionEvent()` for idempotent server-side mutation.
3. `app/api/multiplayer/action/route.js`
   - Awards progression for combat (`fire`), objective-related action types, and session completion action types.
   - Emits `progressionDelta` in response payloads for HUD updates.
4. `app/api/multiplayer/simulation-events/route.js`
   - Adds `POST` for explicit event-triggered progression awards (objective/session pipelines).
   - Returns lightweight `progressionDelta` and optional `progressionSnapshot`.

## Trigger definitions

- `first_join`
  - Triggered from `/api/multiplayer/connect`.
  - Rewards: `routeTrips +1`, `multiplayerJumped = true`.
- `objective_participation`
  - Triggered by objective action/event posts.
  - Rewards: `seedCount +1`.
- `combat_contribution`
  - Triggered by `action.type === "fire"`.
  - Rewards: `entropyMined +1`.
- `session_completion`
  - Triggered by completion action/event posts.
  - Rewards: `entropyResolved +1`, `credits +12`.

## Anti-exploit controls

- Idempotency key: `roomName:playerId:eventId`.
  - Duplicate key => no additional rewards.
- Per-session caps:
  - `first_join`: 1
  - `objective_participation`: 4
  - `combat_contribution`: 12
  - `session_completion`: 1
- Cooldowns:
  - objective: 4000 ms
  - combat: 1200 ms
- History limits:
  - processed event IDs retained: 320
  - session counter buckets retained: 24

## Response delta contract

`progressionDelta` is designed for HUD overlays and toast notifications:

- `trigger`
- `applied` / `duplicate`
- `blockedReason` (`CAP_REACHED`, `COOLDOWN_ACTIVE`, etc.)
- `gained` stat increments
- `xpDelta`, `levelDelta`, and current `xp`, `level`, `title` when applied

This avoids shipping full profile documents on every multiplayer tick/action response.
