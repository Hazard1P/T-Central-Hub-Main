create table if not exists public.tcentral_support_ledger (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paypal',
  identifier_type text not null,
  identifier text not null,
  order_id text,
  capture_id text,
  subscription_id text,
  steamid text,
  personaname text,
  plan_id text,
  status text not null default 'VERIFIED',
  paypal_event_type text,
  last_event_id text,
  verification jsonb,
  metadata jsonb,
  linked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tcentral_support_ledger_identifier_type_check check (identifier_type in ('subscription', 'order', 'capture')),
  constraint tcentral_support_ledger_identifier_unique unique (provider, identifier_type, identifier)
);

create index if not exists tcentral_support_ledger_steamid_idx on public.tcentral_support_ledger (steamid);
create index if not exists tcentral_support_ledger_subscription_id_idx on public.tcentral_support_ledger (subscription_id);
create index if not exists tcentral_support_ledger_updated_at_idx on public.tcentral_support_ledger (updated_at desc);

create or replace function public.tcentral_support_ledger_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tcentral_support_ledger_updated_at on public.tcentral_support_ledger;
create trigger trg_tcentral_support_ledger_updated_at
before update on public.tcentral_support_ledger
for each row execute function public.tcentral_support_ledger_set_updated_at();
