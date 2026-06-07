create table if not exists public.player_account_ledger (
  id uuid primary key default gen_random_uuid(),
  identity_id text not null,
  event_type text not null,
  progress_delta jsonb,
  progress jsonb,
  progression jsonb,
  metadata jsonb,
  saved_at timestamptz not null default now(),
  idempotency_key text not null,
  content_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists player_account_ledger_idempotency_key_idx
  on public.player_account_ledger (idempotency_key);

create index if not exists player_account_ledger_identity_saved_at_idx
  on public.player_account_ledger (identity_id, saved_at desc);

create index if not exists player_account_ledger_event_type_idx
  on public.player_account_ledger (event_type);
