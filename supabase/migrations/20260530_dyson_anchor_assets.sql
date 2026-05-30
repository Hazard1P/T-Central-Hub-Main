create table if not exists public.dyson_anchor_assets (
  sphere_key text primary key,
  label text not null,
  position_x double precision not null,
  position_y double precision not null,
  position_z double precision not null,
  ring_one_factor double precision not null default 1,
  ring_two_factor double precision not null default 1,
  ring_three_factor double precision not null default 1,
  encryption_strength_override double precision,
  stellar_class text not null default 'G2V',
  color text not null default '#9dd0ff',
  updated_by text not null default 'system',
  updated_at timestamptz not null default now(),
  constraint dyson_anchor_assets_color_check check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint dyson_anchor_assets_ring_one_factor_check check (ring_one_factor >= 0),
  constraint dyson_anchor_assets_ring_two_factor_check check (ring_two_factor >= 0),
  constraint dyson_anchor_assets_ring_three_factor_check check (ring_three_factor >= 0),
  constraint dyson_anchor_assets_encryption_strength_override_check check (
    encryption_strength_override is null or encryption_strength_override >= 0
  )
);

alter table public.dyson_anchor_assets enable row level security;

create index if not exists dyson_anchor_assets_updated_at_idx on public.dyson_anchor_assets (updated_at desc);

create or replace function public.dyson_anchor_assets_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_dyson_anchor_assets_updated_at on public.dyson_anchor_assets;
create trigger trg_dyson_anchor_assets_updated_at
before update on public.dyson_anchor_assets
for each row execute function public.dyson_anchor_assets_set_updated_at();

insert into public.dyson_anchor_assets (
  sphere_key,
  label,
  position_x,
  position_y,
  position_z,
  ring_one_factor,
  ring_two_factor,
  ring_three_factor,
  encryption_strength_override,
  stellar_class,
  color,
  updated_by
) values
  ('csis', 'Canada Strings of Intelligence Dispersal Dyson Sphere', -6.8, 10.6, 5.8, 1, 1, 1, null, 'A0V', '#8ff3ff', 'migration:worldLayout'),
  ('ss', 'Synaptics.Systems Dyson Sphere', 13.8, -1.4, 6.0, 1, 1, 1, null, 'F8V', '#ffd67d', 'migration:worldLayout'),
  ('affiliates', 'Affiliates', -10.6, -9.4, 6.4, 1, 1, 1, null, 'G2V', '#ff9fd9', 'migration:worldLayout')
on conflict (sphere_key) do update set
  label = excluded.label,
  position_x = excluded.position_x,
  position_y = excluded.position_y,
  position_z = excluded.position_z,
  ring_one_factor = excluded.ring_one_factor,
  ring_two_factor = excluded.ring_two_factor,
  ring_three_factor = excluded.ring_three_factor,
  encryption_strength_override = excluded.encryption_strength_override,
  stellar_class = excluded.stellar_class,
  color = excluded.color,
  updated_by = excluded.updated_by;
