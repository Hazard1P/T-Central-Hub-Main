-- Private account names share the provider/account binding used by game progress.
create table if not exists public.account_usernames (
  provider text not null check (provider in ('google','steam')),
  account_id text not null check (length(account_id) between 1 and 200),
  username text,
  changed_at timestamptz,
  primary key (provider, account_id),
  check (provider <> 'google' or username is null or username ~ '^[A-Za-z0-9][A-Za-z0-9_-]{2,23}$')
);
create unique index if not exists google_username_unique
  on public.account_usernames(lower(username)) where provider = 'google' and username is not null;
alter table public.account_usernames enable row level security;
revoke all on public.account_usernames from public, anon, authenticated;
grant select, insert, update on public.account_usernames to service_role;

create or replace function public.account_username(
  p_provider text, p_account_id text, p_default text, p_username text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  profile public.account_usernames%rowtype;
  server_now timestamptz;
  next_change timestamptz;
begin
  if p_provider not in ('google','steam') or p_provider is null or p_account_id is null
    or length(p_account_id) not between 1 and 200 then raise exception 'Invalid account'; end if;
  if p_provider = 'steam' and p_username is not null then
    return jsonb_build_object('ok',false,'error','STEAM_MANAGED');
  end if;
  if p_provider = 'google' and p_username is not null
    and p_username !~ '^[A-Za-z0-9][A-Za-z0-9_-]{2,23}$' then
    return jsonb_build_object('ok',false,'error','INVALID_USERNAME');
  end if;
  insert into public.account_usernames(provider,account_id) values(p_provider,p_account_id)
    on conflict(provider,account_id) do nothing;
  select * into profile from public.account_usernames
    where provider=p_provider and account_id=p_account_id for update;
  -- Read wall time after taking the lock, including when requests are queued.
  server_now := clock_timestamp();
  next_change := profile.changed_at + interval '720 hours';
  if p_provider = 'steam' and nullif(trim(p_default),'') is not null then
    update public.account_usernames set username=left(p_default,160)
      where provider=p_provider and account_id=p_account_id returning * into profile;
  elsif p_provider = 'google' and p_username is not null and p_username is distinct from profile.username then
    if next_change is not null and server_now < next_change then
      return jsonb_build_object('ok',false,'error','USERNAME_COOLDOWN','nextChangeAt',next_change,'serverTime',server_now);
    end if;
    begin
      update public.account_usernames set username=p_username,changed_at=server_now
        where provider=p_provider and account_id=p_account_id returning * into profile;
    exception when unique_violation then
      return jsonb_build_object('ok',false,'error','USERNAME_TAKEN');
    end;
  end if;
  next_change := profile.changed_at + interval '720 hours';
  return jsonb_build_object('ok',true,'ownerKey',p_provider||':'||p_account_id,'provider',p_provider,
    'username',coalesce(profile.username,p_default,case when p_provider='steam' then 'Steam Pilot' else 'Google Pilot' end),
    'custom',p_provider='google' and profile.username is not null,
    'managedBySteam',p_provider='steam','canChange',p_provider='google' and (next_change is null or server_now>=next_change),
    'changedAt',profile.changed_at,'nextChangeAt',next_change,'serverTime',server_now);
end; $$;
revoke all on function public.account_username(text,text,text,text) from public, anon, authenticated;
grant execute on function public.account_username(text,text,text,text) to service_role;
