create table if not exists public.matrixcoin_wallets (
  wallet_id uuid primary key default gen_random_uuid(),
  identity_id text not null,
  account_provider text not null,
  account_id text not null,
  display_name text,
  player_id text not null,
  node_key text not null default 'matrixcoinexchange',
  mode_scope text not null default 'singleplayer:matrixcoinexchange',
  status text not null default 'active' check (status in ('active', 'locked', 'suspended', 'archived')),
  available_micro_ec bigint not null default 0 check (available_micro_ec >= 0),
  reserved_micro_ec bigint not null default 0 check (reserved_micro_ec >= 0),
  lifetime_minted_micro_ec bigint not null default 0 check (lifetime_minted_micro_ec >= 0),
  lifetime_burned_micro_ec bigint not null default 0 check (lifetime_burned_micro_ec >= 0),
  last_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint matrixcoin_wallets_node_key_chk check (node_key = 'matrixcoinexchange'),
  constraint matrixcoin_wallets_mode_scope_chk check (mode_scope ~ '^(singleplayer|multiplayer):[A-Za-z0-9_-]+$')
);

create unique index if not exists matrixcoin_wallets_identity_node_scope_idx
  on public.matrixcoin_wallets (identity_id, node_key, mode_scope);

create index if not exists matrixcoin_wallets_account_idx
  on public.matrixcoin_wallets (account_provider, account_id);

create table if not exists public.matrixcoin_ledger_entries (
  transaction_id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.matrixcoin_wallets(wallet_id) on delete cascade,
  identity_id text not null,
  event_seq bigint not null check (event_seq >= 0),
  tick_id bigint not null default 0 check (tick_id >= 0),
  entry_type text not null check (entry_type in ('mint', 'sink', 'conversion', 'settlement', 'reversal')),
  amount_micro_ec bigint not null check (amount_micro_ec >= 0),
  idempotency_key text not null,
  origin_event_id text not null,
  mint_reason_code text check (mint_reason_code in ('simulation_objective_reward', 'baseline_stipend', 'admin_recovery') or mint_reason_code is null),
  previous_hash text not null,
  entry_hash text not null,
  settlement_state text not null default 'pending' check (settlement_state in ('pending', 'settled', 'reversed', 'rejected')),
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create unique index if not exists matrixcoin_ledger_entries_idempotency_key_idx
  on public.matrixcoin_ledger_entries (idempotency_key);

create unique index if not exists matrixcoin_ledger_entries_wallet_seq_idx
  on public.matrixcoin_ledger_entries (wallet_id, event_seq);

create index if not exists matrixcoin_ledger_entries_identity_recorded_at_idx
  on public.matrixcoin_ledger_entries (identity_id, recorded_at desc);

create table if not exists public.matrixcoin_settlements (
  settlement_id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.matrixcoin_wallets(wallet_id) on delete cascade,
  ledger_transaction_id uuid references public.matrixcoin_ledger_entries(transaction_id) on delete set null,
  identity_id text not null,
  node_key text not null default 'matrixcoinexchange',
  idempotency_key text not null,
  origin_event_id text not null,
  entropy_units numeric not null default 0 check (entropy_units >= 0),
  stabilized_entropy numeric not null default 0 check (stabilized_entropy >= 0),
  credit_quote numeric not null default 0 check (credit_quote >= 0),
  credit_micro_ec bigint not null default 0 check (credit_micro_ec >= 0),
  route_integrity numeric,
  settlement_state text not null default 'settled' check (settlement_state in ('pending', 'settled', 'reversed', 'rejected')),
  telemetry jsonb not null default '{}'::jsonb,
  settled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint matrixcoin_settlements_node_key_chk check (node_key = 'matrixcoinexchange')
);

create unique index if not exists matrixcoin_settlements_idempotency_key_idx
  on public.matrixcoin_settlements (idempotency_key);

create index if not exists matrixcoin_settlements_identity_settled_at_idx
  on public.matrixcoin_settlements (identity_id, settled_at desc);
