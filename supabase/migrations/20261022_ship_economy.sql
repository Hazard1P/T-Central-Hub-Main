-- Game-only currency. No conversion from support, VIP or legacy client progression.
create table if not exists public.ship_wallets (
  owner text primary key, credits bigint not null default 0 check (credits >= 0),
  cargo integer not null default 0 check (cargo >= 0),
  cargo_level integer not null default 0 check (cargo_level between 0 and 3),
  laser_level integer not null default 0 check (laser_level between 0 and 3),
  delivered bigint not null default 0, last_mine bigint not null default 0,
  flight_token text not null default '', room text not null default '',
  check (cargo <= 20 + cargo_level * 15)
);
create table if not exists public.ship_mining_rocks (
  room text not null, asteroid text not null, hp integer not null default 3 check (hp between 0 and 3),
  depleted_until bigint not null default 0, primary key (room, asteroid)
);
create table if not exists public.ship_economy_receipts (
  owner text not null references public.ship_wallets(owner), request_id text not null,
  receipt jsonb not null, created_at timestamptz not null default now(), primary key (owner, request_id)
);
alter table public.ship_wallets enable row level security;
alter table public.ship_mining_rocks enable row level security;
alter table public.ship_economy_receipts enable row level security;
revoke all on public.ship_wallets, public.ship_mining_rocks, public.ship_economy_receipts from public, anon, authenticated;
grant all on public.ship_wallets, public.ship_mining_rocks, public.ship_economy_receipts to service_role;

create or replace function public.ship_economy_action(
  p_owner text, p_room text, p_token text, p_request text, p_action text,
  p_asteroid text, p_upgrade text, p_expected integer, p_at_earth boolean, p_slow boolean, p_now bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  w ship_wallets%rowtype; r ship_mining_rocks%rowtype;
  receipt jsonb; replay boolean := false; ore integer; rock_index integer; lvl integer; price integer;
  field jsonb;
begin
  if p_owner is null or length(p_owner) > 200 or p_room !~ '^[a-zA-Z0-9_-]{1,64}$' or length(p_token) < 16 then
    raise exception 'Invalid flight binding.';
  end if;
  insert into ship_wallets(owner) values(p_owner) on conflict do nothing;
  select * into w from ship_wallets where owner = p_owner for update;
  if w.flight_token <> p_token or w.room <> p_room then
    w.cargo := 0; w.flight_token := p_token; w.room := p_room;
  end if;
  if p_action <> 'state' then
    if p_request is null or p_request !~ '^[a-f0-9-]{36}$' then raise exception 'Invalid action receipt.'; end if;
    select sr.receipt into receipt from ship_economy_receipts sr where sr.owner = p_owner and sr.request_id = p_request;
    replay := found;
    if not replay then
      if p_action = 'mine' then
        if p_now - w.last_mine < 700 then raise exception 'Mining laser is cooling down.'; end if;
        if w.cargo >= 20 + w.cargo_level * 15 then raise exception 'Cargo hold full. Deliver your ore to Earth.'; end if;
        if p_asteroid is null or p_asteroid !~ '^ore-[0-9]{1,2}$' then raise exception 'Unknown asteroid.'; end if;
        rock_index := substring(p_asteroid from 5)::integer;
        if rock_index < 0 or rock_index >= 24 then raise exception 'Unknown asteroid.'; end if;
        insert into ship_mining_rocks(room,asteroid) values(p_room,p_asteroid) on conflict do nothing;
        select * into r from ship_mining_rocks where room=p_room and asteroid=p_asteroid for update;
        if r.hp = 0 and r.depleted_until > p_now then raise exception 'Asteroid depleted. Find another rock or wait for regeneration.'; end if;
        if r.hp = 0 then r.hp := 3; end if;
        r.hp := greatest(0, r.hp - 1 - w.laser_level);
        w.last_mine := p_now; ore := 0;
        if r.hp = 0 then
          ore := least(4 + rock_index % 4, 20 + w.cargo_level * 15 - w.cargo);
          r.depleted_until := p_now + 45000; w.cargo := w.cargo + ore;
        end if;
        update ship_mining_rocks set hp=r.hp, depleted_until=r.depleted_until where room=p_room and asteroid=p_asteroid;
        receipt := jsonb_build_object('type','mine','asteroid',p_asteroid,'hp',r.hp,'ore',ore);
      elsif p_action = 'deliver' then
        if not coalesce(p_at_earth and p_slow,false) then raise exception 'Return to Earth and brake below 8 u/s to unload.'; end if;
        if w.cargo = 0 then raise exception 'Your cargo hold is empty.'; end if;
        receipt := jsonb_build_object('type','deliver','ore',w.cargo,'credits',w.cargo * 10);
        w.credits := w.credits + w.cargo * 10; w.delivered := w.delivered + w.cargo; w.cargo := 0;
      elsif p_action = 'upgrade' then
        if not coalesce(p_at_earth and p_slow,false) then raise exception 'Return to Earth and brake below 8 u/s to upgrade.'; end if;
        if p_upgrade not in ('cargo','laser') or p_upgrade is null then raise exception 'Unknown upgrade.'; end if;
        lvl := case when p_upgrade='cargo' then w.cargo_level else w.laser_level end;
        if p_expected is null or p_expected <> lvl then raise exception 'Upgrade selection changed. Refresh your shipyard.'; end if;
        if lvl >= 3 then raise exception 'This upgrade is already at maximum level.'; end if;
        price := case when p_upgrade='cargo' then (array[120,240,480])[lvl+1] else (array[150,300,600])[lvl+1] end;
        if w.credits < price then raise exception 'Earn more credits by delivering ore to Earth.'; end if;
        w.credits := w.credits - price;
        if p_upgrade='cargo' then w.cargo_level := lvl+1; else w.laser_level := lvl+1; end if;
        receipt := jsonb_build_object('type','upgrade','upgrade',p_upgrade,'level',lvl+1,'credits',-price);
      else raise exception 'Unknown ship action.';
      end if;
      insert into ship_economy_receipts(owner,request_id,receipt) values(p_owner,p_request,receipt);
    end if;
  end if;
  update ship_wallets set credits=w.credits, cargo=w.cargo, cargo_level=w.cargo_level, laser_level=w.laser_level,
    delivered=w.delivered,last_mine=w.last_mine,flight_token=w.flight_token,room=w.room where owner=p_owner;
  select coalesce(jsonb_object_agg(asteroid,jsonb_build_object('hp',hp,'depleted_until',depleted_until)),'{}'::jsonb)
    into field from ship_mining_rocks where room=p_room;
  return jsonb_build_object('wallet',to_jsonb(w)-'owner'-'flight_token'-'room','rocks',field,'receipt',receipt,'replay',replay);
end;
$$;
revoke all on function public.ship_economy_action(text,text,text,text,text,text,text,integer,boolean,boolean,bigint) from public, anon, authenticated;
grant execute on function public.ship_economy_action(text,text,text,text,text,text,text,integer,boolean,boolean,bigint) to service_role;

-- Flight positions and bearer tokens must also remain server-only. The active
-- client receives a sanitized room snapshot through /api/multiplayer/state.
alter table public.multiplayer_rooms enable row level security;
alter table public.multiplayer_players enable row level security;
alter table public.multiplayer_events enable row level security;
revoke all on public.multiplayer_rooms, public.multiplayer_players, public.multiplayer_events from public, anon, authenticated;
grant all on public.multiplayer_rooms, public.multiplayer_players, public.multiplayer_events to service_role;
-- Simulation audit rows contain session bindings too.
alter table public.simulation_events enable row level security;
revoke all on public.simulation_events from public, anon, authenticated;
grant all on public.simulation_events to service_role;
