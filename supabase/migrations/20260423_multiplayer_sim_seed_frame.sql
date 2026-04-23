alter table public.multiplayer_players
  add column if not exists simulation_seed text,
  add column if not exists frame_index bigint not null default 0;

create index if not exists multiplayer_players_room_frame_idx
  on public.multiplayer_players(room_name, frame_index desc);
