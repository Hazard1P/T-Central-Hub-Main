create table if not exists public.simulation_events (
  event_id text primary key,
  room_name text not null references public.multiplayer_rooms(room_name) on delete cascade,
  player_id text not null,
  session_id text not null,
  event_timestamp timestamptz not null default now(),
  frame_index bigint not null,
  source text not null default 'state',
  physics_input jsonb not null default '{}'::jsonb,
  physics_output jsonb not null default '{}'::jsonb,
  event_checksum text not null,
  created_at timestamptz not null default now()
);

create index if not exists simulation_events_room_time_idx on public.simulation_events(room_name, event_timestamp desc);
create index if not exists simulation_events_player_time_idx on public.simulation_events(room_name, player_id, event_timestamp desc);
create index if not exists simulation_events_session_time_idx on public.simulation_events(room_name, session_id, event_timestamp desc);

alter table public.simulation_events replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.simulation_events;
exception when duplicate_object then null; end $$;
