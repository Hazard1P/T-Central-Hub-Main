create table if not exists public.player_accounts (
  account_key text primary key,
  steam_id text unique,
  provider text not null default 'steam',
  account_id text,
  display_name text not null default 'Steam Pilot',
  profile_url text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.player_accounts
  add column if not exists provider text not null default 'steam',
  add column if not exists account_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.player_accounts
  alter column steam_id drop not null;

update public.player_accounts
  set account_id = steam_id
  where provider = 'steam' and account_id is null and steam_id is not null;

update public.player_accounts
  set account_id = account_key
  where account_id is null;

create unique index if not exists player_accounts_provider_account_id_idx
  on public.player_accounts (provider, account_id);

alter table public.player_account_ledger
  add column if not exists identity_id text,
  add column if not exists account_key text,
  add column if not exists event_type text,
  add column if not exists event_payload jsonb not null default '{}'::jsonb,
  add column if not exists progress_delta jsonb,
  add column if not exists progress jsonb,
  add column if not exists progression jsonb,
  add column if not exists metadata jsonb,
  add column if not exists saved_at timestamptz not null default now(),
  add column if not exists idempotency_key text,
  add column if not exists content_hash text,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists player_account_ledger_idempotency_key_idx
  on public.player_account_ledger (idempotency_key);

create index if not exists player_account_ledger_account_key_created_at_idx
  on public.player_account_ledger (account_key, created_at desc);

create index if not exists player_account_ledger_identity_saved_at_idx
  on public.player_account_ledger (identity_id, saved_at desc);
