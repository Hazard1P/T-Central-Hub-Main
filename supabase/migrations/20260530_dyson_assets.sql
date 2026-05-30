create table if not exists public.dyson_assets (
  asset_key text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.dyson_assets is 'Admin-editable Dyson world layout overrides keyed to lib/worldLayout.js defaults.';
comment on column public.dyson_assets.asset_key is 'Matches a Dyson node key from lib/worldLayout.js.';
comment on column public.dyson_assets.payload is 'Sanitized mapAnchor and allowed Dyson parameter overrides.';
