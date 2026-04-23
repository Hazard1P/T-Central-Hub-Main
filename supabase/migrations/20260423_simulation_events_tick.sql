alter table public.simulation_events
  add column if not exists tick bigint;

create index if not exists simulation_events_room_tick_idx
  on public.simulation_events(room_name, tick desc);
