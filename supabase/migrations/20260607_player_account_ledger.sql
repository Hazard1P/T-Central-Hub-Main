create table if not exists public.player_account_ledger (
  event_id text primary key,
  identity_id text not null,
  display_name text not null,
  identity_kind text not null default 'guest',
  authenticated boolean not null default false,
  event_type text not null,
  progress jsonb not null default '{}'::jsonb,
  progression jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists player_account_ledger_identity_created_idx
  on public.player_account_ledger (identity_id, created_at desc);

create index if not exists player_account_ledger_event_type_idx
  on public.player_account_ledger (event_type);
