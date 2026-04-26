# Economy Validation Checklist

Use this checklist before shipping any economy-impacting release.

## 1) No duplicate credit mint paths
- [ ] Enumerate all active mint handlers in code/config.
- [ ] Confirm active handlers map to only:
  - [ ] `simulation_objective_reward`
  - [ ] `baseline_stipend`
  - [ ] `admin_recovery`
- [ ] Assert no extra mint reason codes exist in production config.
- [ ] Verify uniqueness constraint on (`wallet_id`, `idempotency_key`, `mint_reason_code`).
- [ ] Run replay of known duplicate events and verify second apply is no-op.

## 2) Deterministic sink behavior
- [ ] Validate sink formulas operate only on integer `micro_ec` values.
- [ ] Confirm rounding mode is always floor.
- [ ] Re-run sink simulation twice with identical ordered inputs.
- [ ] Compare outputs byte-for-byte (amounts, ordering, hashes).
- [ ] Check deterministic ordering by `(tick_id, event_seq)`.

## 3) Replay-safe transaction logging
- [ ] Confirm ledger is append-only (no mutation paths for historical records).
- [ ] Ensure each transaction includes:
  - [ ] `transaction_id`
  - [ ] `idempotency_key`
  - [ ] `origin_event_id`
  - [ ] `previous_hash`
  - [ ] `entry_hash`
  - [ ] `settlement_state`
- [ ] Recompute hash chain from genesis checkpoint and verify parity.
- [ ] Validate replays are idempotent and do not duplicate balances.
- [ ] Verify compensating-entry flow for reversals instead of hard deletes.

## 4) Mode isolation rules for singleplayer instances
- [ ] Verify each singleplayer wallet uses `mode_scope = singleplayer:{instance_id}`.
- [ ] Confirm singleplayer ledger writes are isolated from multiplayer clusters.
- [ ] Attempt unauthorized singleplayer->multiplayer transfer and verify rejection.
- [ ] Confirm cross-mode transfer requires:
  - [ ] source settlement complete
  - [ ] anti-cheat attestation
  - [ ] unique transfer key
  - [ ] release budget availability
- [ ] Validate failed transfers remain in pending hold and do not mint net new EC.

## Evidence Pack (attach to release notes)
- [ ] Mint-path audit artifact
- [ ] Deterministic sink replay diff (should be empty)
- [ ] Ledger hash-chain verification output
- [ ] Singleplayer isolation test log
