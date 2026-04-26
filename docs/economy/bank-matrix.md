# Bank Matrix Economy Specification (Canonical)

## Purpose
This document defines the canonical economy model for T-Central Hub and all attached simulation surfaces. It standardizes credit creation, destruction (sinks), conversion behavior, inflation controls, and singleplayer/multiplayer mode boundaries.

## Core Monetary Unit
- **Entropic Credit (EC):** primary value token for player-facing economy operations.
- **Minor unit:** `micro_ec` (1 EC = 1,000,000 micro_ec) for deterministic calculations.
- **Ledger arithmetic rule:** all operations are integer-safe in `micro_ec`; rendering to EC is a presentation concern.

## Key Entities
- `wallet`: owner-scoped balance container (`player_id`, `mode_scope`, status metadata).
- `entropic_credit_balance`: materialized running totals (`available_micro_ec`, `reserved_micro_ec`, `lifetime_minted_micro_ec`, `lifetime_burned_micro_ec`).
- `transaction_ledger`: append-only immutable sequence of credits/debits/conversions/settlements.
- `entropy_decay_rules`: deterministic decay and sink schedules bound to game loops.
- `settlement_state`: lifecycle markers for pending/settled/reversed records and anti-replay checkpoints.

## Credit Creation (Minting)
Canonical mint paths are constrained to exactly three sources:

1. **Simulation objective reward mint**
   - Trigger: verified completion event from authoritative simulation loop.
   - Bound by per-objective mint caps and global emission budgets.
2. **Scheduled baseline stipend mint**
   - Trigger: periodic grant window for active players.
   - Bound by cadence, eligibility state, and anti-idle abuse thresholds.
3. **Admin recovery mint (break-glass)**
   - Trigger: audited manual corrective action.
   - Requires privileged role + immutable reason code + incident link.

### Mint Guardrails
- Every mint requires a globally unique `idempotency_key`.
- Mint routes must map to a `mint_reason_code` enum.
- Duplicate mint detection is done on (`wallet_id`, `idempotency_key`, `mint_reason_code`).
- Mints are rejected if daily or epoch inflation guardrails are exceeded.

## Credit Sinks (Value Removal)
Canonical sinks (burn or lock) are deterministic and order-preserving:

- **Upgrade sink:** spend on progression unlocks.
- **Maintenance sink:** periodic upkeep for persistent assets.
- **Trade fee sink:** percentage fee on peer trades.
- **Entropy decay sink:** scheduled decay from inactive/preserved balances.
- **Penalty sink:** enforcement-driven burns from validated sanctions.

### Sink Determinism Rules
- Sink formulas use integer arithmetic in `micro_ec`.
- Rounding is always floor toward zero.
- Event ordering source of truth is `(tick_id, event_seq)`.
- Reprocessing the same ordered input must produce byte-equivalent sink outputs.

## Conversion Rules
Conversions are allowed between scoped balances but never bypass sinks:

- **Allowed:** `available -> reserved`, `reserved -> available`, `mode_wallet -> cross_mode_vault`.
- **Disallowed:** direct conversion that creates net new EC.
- **Conversion formula:**
  - `output = floor(input * conversion_rate_ppm / 1_000_000)`
  - `conversion_fee = input - reverse_projection(output)` where applicable.
- **Rate Source:** versioned table (`rate_version`) captured per transaction for replay consistency.

## Anti-Inflation Controls
- **Global emission budget:** max minted micro_ec per epoch.
- **Per-wallet mint ceiling:** daily and rolling-window hard limits.
- **Velocity checks:** cap rapid inbound mint volume relative to playtime quality metrics.
- **Dynamic sink multiplier:** increase sink intensity when circulating supply exceeds threshold.
- **Dormancy decay:** inactive balances decay per `entropy_decay_rules` with protected minimum floor.
- **Circuit breaker:** suspend non-essential mint paths when anomaly score exceeds policy threshold.

## Settlement and Replay Safety
- Ledger is append-only; no in-place mutation of amount fields.
- Every entry carries:
  - `transaction_id`
  - `idempotency_key`
  - `origin_event_id`
  - `previous_hash`
  - `entry_hash`
  - `settlement_state`
- Replay workflow validates hash chain, idempotency keys, and settlement transitions before apply.
- Reconciliation jobs only add compensating entries (never destructive edits).

## Cross-Mode Behavior (Singleplayer vs Multiplayer)

### Singleplayer
- Singleplayer wallets are **instance-isolated** (`mode_scope = singleplayer:{instance_id}`).
- Singleplayer mints/sinks never alter multiplayer circulation directly.
- Export to shared vault requires explicit end-of-session settlement and anti-cheat attestation.

### Multiplayer
- Multiplayer wallets are **cluster-scoped** (`mode_scope = multiplayer:{cluster_id}`).
- Authoritative simulation events are validated server-side before ledger writes.
- Shared market sinks and fees are enforced uniformly across participants.

### Cross-Mode Transfer Policy
- Transfers are one-way through `cross_mode_vault` with policy-gated release.
- Required checks:
  1. source mode settlement complete
  2. anti-cheat attestation pass
  3. duplicate transfer key not seen
  4. release budget available
- Any failed check leaves funds in pending hold state.

## Read Model Requirements
A read model must be available in Main Area with at least:
- wallet scope + mode
- available EC
- reserved EC
- pending settlement count
- current decay profile
- last settlement timestamp

## Compliance Criteria
Implementation is conformant only if:
1. exactly the three canonical mint paths are active,
2. sinks are deterministic and replay-stable,
3. all ledger writes are idempotent and hash-chain verifiable,
4. singleplayer instances remain isolated unless explicit policy transfer succeeds.
