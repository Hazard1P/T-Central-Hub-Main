create table if not exists public.multiplayer_rooms (
  room_name text primary key,
  tick bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_event_at timestamptz not null default now()
);

create table if not exists public.multiplayer_players (
  room_name text not null references public.multiplayer_rooms(room_name) on delete cascade,
  player_id text not null,
  session_token text not null,
  display_name text not null default 'Pilot',
  avatar_url text,
  identity_kind text not null default 'guest',
  authenticated boolean not null default false,
  position jsonb not null default '[0,0,18]'::jsonb,
  velocity jsonb not null default '[0,0,0]'::jsonb,
  direction jsonb not null default '[0,0,-1]'::jsonb,
  nearest text,
  speed double precision not null default 0,
  quantum_signature text not null default 'Q12D-0-0',
  health integer not null default 100,
  shield integer not null default 100,
  score integer not null default 0,
  combat_state jsonb not null default '{"firing":false,"lastShotAt":0}'::jsonb,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_name, player_id)
);

create table if not exists public.multiplayer_events (
  id text primary key,
  room_name text not null references public.multiplayer_rooms(room_name) on delete cascade,
  event_type text not null,
  player_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists multiplayer_players_room_seen_idx on public.multiplayer_players(room_name, last_seen desc);
create index if not exists multiplayer_events_room_created_idx on public.multiplayer_events(room_name, created_at desc);
create index if not exists multiplayer_events_type_idx on public.multiplayer_events(room_name, event_type, created_at desc);

alter table public.multiplayer_rooms replica identity full;
alter table public.multiplayer_players replica identity full;
alter table public.multiplayer_events replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.multiplayer_rooms;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.multiplayer_players;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.multiplayer_events;
exception when duplicate_object then null; end $$;
