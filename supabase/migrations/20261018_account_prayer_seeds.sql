-- OAuth cookies are verified by Next.js. Only its service-role connection accesses these tables.
create table if not exists public.account_cyber_intelligence (
  id uuid primary key,
  account_key text not null unique,
  provider text not null check (provider in ('steam', 'google')),
  account_id text not null,
  created_at timestamptz not null,
  epoch_unix bigint not null check (epoch_unix >= 0),
  protocol text not null,
  sequence jsonb not null,
  check (account_key = provider || ':' || account_id),
  check (epoch_unix = floor(extract(epoch from created_at))),
  unique (provider, account_id),
  unique (account_key, id),
  foreign key (provider, account_id) references public.player_accounts(provider, account_id) on delete cascade
);

create table if not exists public.account_prayer_seeds (
  id uuid primary key,
  account_key text not null,
  cyber_intelligence_id uuid not null,
  request_id text not null,
  body text not null check (char_length(body) between 1 and 320),
  flight_signature text not null,
  created_at timestamptz not null,
  epoch_unix bigint not null check (epoch_unix >= 0),
  epoch_anchor jsonb not null,
  kind text not null check (kind = 'In-Prayer-Intelligence'),
  origin text not null,
  binding_hash text not null check (binding_hash ~ '^[a-f0-9]{64}$'),
  check (epoch_unix = floor(extract(epoch from created_at))),
  unique (account_key, request_id),
  foreign key (account_key, cyber_intelligence_id) references public.account_cyber_intelligence(account_key, id) on delete cascade
);
create index if not exists account_prayer_seeds_owner_created_idx on public.account_prayer_seeds(account_key, created_at desc);
alter table public.account_cyber_intelligence enable row level security;
alter table public.account_prayer_seeds enable row level security;
revoke all on public.account_cyber_intelligence from anon, authenticated;
revoke all on public.account_prayer_seeds from anon, authenticated;
grant select, insert on public.account_cyber_intelligence to service_role;
grant select, insert on public.account_prayer_seeds to service_role;
