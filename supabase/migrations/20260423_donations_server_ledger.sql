create table if not exists public.tcentral_donations (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  steamid text not null,
  personaname text,
  amount numeric(12, 2) not null,
  currency text not null,
  anchor_slug text not null default 'deep_blackhole',
  solar_system_key text not null default 'solar_system',
  status text not null default 'CREATED',
  paypal_status text,
  capture_status text,
  capture_id text,
  capture_amount numeric(12, 2),
  capture_currency text,
  capture_metadata jsonb,
  capture_idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  captured_at timestamptz,
  constraint tcentral_donations_status_check check (status in ('CREATED', 'CONFIRMED')),
  constraint tcentral_donations_capture_idempotency_key_uniq unique (capture_idempotency_key)
);

create index if not exists tcentral_donations_steamid_idx on public.tcentral_donations (steamid);
create index if not exists tcentral_donations_status_idx on public.tcentral_donations (status);
create index if not exists tcentral_donations_updated_at_idx on public.tcentral_donations (updated_at desc);

create or replace function public.tcentral_donations_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tcentral_donations_updated_at on public.tcentral_donations;
create trigger trg_tcentral_donations_updated_at
before update on public.tcentral_donations
for each row execute function public.tcentral_donations_set_updated_at();
