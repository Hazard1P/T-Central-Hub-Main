create table if not exists public.arma_server_integrations (
  server_id text primary key,
  slug text not null unique,
  server_build text not null,
  pbo_package text not null,
  pbo_mount text not null,
  mission_id text not null,
  mission_version text not null,
  account_storage_table text not null default 'player_progression',
  integration_state text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.player_vip_memberships (
  identity_id text primary key,
  tier text not null,
  xp_boost numeric(4,3) not null default 0,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  perks jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  updated_at timestamptz not null default now(),
  constraint player_vip_memberships_tier_check check (tier in ('supporter', 'elite', 'commander')),
  constraint player_vip_memberships_status_check check (status in ('active', 'expired', 'revoked')),
  constraint player_vip_memberships_xp_boost_check check (xp_boost >= 0 and xp_boost <= 0.350)
);

insert into public.arma_server_integrations (
  server_id,
  slug,
  server_build,
  pbo_package,
  pbo_mount,
  mission_id,
  mission_version,
  account_storage_table,
  integration_state,
  metadata
)
values (
  'tcentral-arma3-cth-01',
  'arma3-cth',
  'KOTH_REBUILD_V1',
  'tcentral_koth_hub.pbo',
  '@tcentral_kothhub/addons/tcentral_koth_hub.pbo',
  'koth_altis_rebuild',
  '2026.04.23',
  'player_progression',
  'active',
  jsonb_build_object(
    'vipEnabled', true,
    'vipTiers', jsonb_build_array('supporter', 'elite', 'commander')
  )
)
on conflict (server_id) do update
set
  slug = excluded.slug,
  server_build = excluded.server_build,
  pbo_package = excluded.pbo_package,
  pbo_mount = excluded.pbo_mount,
  mission_id = excluded.mission_id,
  mission_version = excluded.mission_version,
  account_storage_table = excluded.account_storage_table,
  integration_state = excluded.integration_state,
  metadata = excluded.metadata,
  updated_at = now();
