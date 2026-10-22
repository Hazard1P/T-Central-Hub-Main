-- Room admission is serialized in PostgreSQL, across all web workers.
alter table public.multiplayer_rooms add column if not exists capacity integer not null default 128 check(capacity between 1 and 128);
create or replace function public.join_multiplayer_room(
 p_room text,p_player text,p_token text,p_name text,p_avatar text,p_kind text,p_authenticated boolean,p_spawn jsonb,p_capacity integer
) returns jsonb language plpgsql security definer set search_path=public as $$
declare pilot multiplayer_players%rowtype; population integer; stamp timestamptz := clock_timestamp();
begin
 if p_room is null or p_room !~ '^[a-zA-Z0-9_-]{1,64}$' or p_player is null or length(p_player)>200 or p_token is null or length(p_token)<16 or p_capacity is null or p_capacity not between 1 and 128 or jsonb_typeof(p_spawn)<>'array' or jsonb_array_length(p_spawn)<>3 then raise exception 'Invalid room admission.'; end if;
 insert into multiplayer_rooms(room_name,capacity) values(p_room,p_capacity) on conflict do nothing;
 perform 1 from multiplayer_rooms where room_name=p_room for update;
 stamp := clock_timestamp();
 update multiplayer_rooms set capacity=p_capacity where room_name=p_room;
 delete from multiplayer_players where room_name=p_room and last_seen < stamp-interval '30 seconds';
 select * into pilot from multiplayer_players where room_name=p_room and player_id=p_player for update;
 select count(*)::integer into population from multiplayer_players where room_name=p_room;
 if pilot.player_id is null then
  if population>=p_capacity then return jsonb_build_object('ok',false,'status',409,'error','ROOM_FULL','room',p_room,'retryAfter',5,'population',jsonb_build_object('playerCount',population,'capacity',p_capacity,'available',0,'full',true)); end if;
  insert into multiplayer_players(room_name,player_id,session_token,display_name,avatar_url,identity_kind,authenticated,position,nearest,simulation_seed,last_seen,updated_at)
    values(p_room,p_player,p_token,left(p_name,32),p_avatar,p_kind,p_authenticated,p_spawn,'solar-earth',p_room,stamp,stamp) returning * into pilot;
  population := population+1;
 else
  -- A rejoin only refreshes identity/lease. It never rewrites live movement.
  update multiplayer_players set display_name=left(p_name,32),avatar_url=p_avatar,identity_kind=p_kind,authenticated=p_authenticated,last_seen=stamp
   where room_name=p_room and player_id=p_player returning * into pilot;
 end if;
 update multiplayer_rooms set tick=(extract(epoch from stamp)*1000)::bigint,updated_at=stamp where room_name=p_room;
 return jsonb_build_object('ok',true,'room',p_room,'token',pilot.session_token,'player',to_jsonb(pilot),'population',jsonb_build_object('playerCount',population,'capacity',p_capacity,'available',greatest(0,p_capacity-population),'full',population>=p_capacity));
end $$;
revoke all on function public.join_multiplayer_room(text,text,text,text,text,text,boolean,jsonb,integer) from public,anon,authenticated;
grant execute on function public.join_multiplayer_room(text,text,text,text,text,text,boolean,jsonb,integer) to service_role;

alter table public.multiplayer_rooms enable row level security;
alter table public.multiplayer_players enable row level security;
alter table public.multiplayer_events enable row level security;
revoke all on public.multiplayer_rooms, public.multiplayer_players, public.multiplayer_events from public,anon,authenticated;
grant all on public.multiplayer_rooms, public.multiplayer_players, public.multiplayer_events to service_role;
