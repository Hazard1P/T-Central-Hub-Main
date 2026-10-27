-- Requires 20261027_account_usernames.sql. Private, service-role-only moderation.
create table if not exists public.moderation_reports (
  reference text primary key,
  reporter jsonb,
  rate_key text not null,
  reported_player text not null,
  target_key text,
  chat_message_id uuid,
  location text not null,
  reason text not null,
  evidence text not null,
  status text not null default 'received' check (status in ('received','reviewing','resolved','dismissed')),
  created_at timestamptz not null default clock_timestamp(),
  reviewed_at timestamptz
);
alter table public.moderation_reports add column if not exists chat_message_id uuid;
create index if not exists moderation_report_rate_idx on public.moderation_reports(rate_key, created_at desc);
create index if not exists moderation_report_created_idx on public.moderation_reports(created_at desc);
create table if not exists public.player_bans (
  account_key text primary key,
  reason text not null,
  expires_at timestamptz,
  actor text not null,
  created_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz
);
create table if not exists public.moderation_actions (
  id bigint generated always as identity primary key,
  actor text not null,
  target_key text,
  report_reference text references public.moderation_reports(reference),
  action text not null,
  chat_message_id uuid,
  reason text not null,
  expires_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.moderation_actions add column if not exists chat_message_id uuid;
alter table public.moderation_reports enable row level security;
alter table public.player_bans enable row level security;
alter table public.moderation_actions enable row level security;
revoke all on public.moderation_reports, public.player_bans, public.moderation_actions from public, anon, authenticated;
grant all on public.moderation_reports, public.player_bans, public.moderation_actions to service_role;
grant usage, select on sequence public.moderation_actions_id_seq to service_role;

create or replace function public.moderation_submit_report(p_report jsonb, p_reporter jsonb, p_rate_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_target text; v_reference text; v_matches text[];
begin
  if p_rate_key is null or length(p_rate_key) > 200 or length(trim(p_rate_key)) < 1
    or coalesce(length(trim(p_report->>'reportedPlayer')),0) not between 1 and 160
    or coalesce(length(trim(p_report->>'server')),0) not between 1 and 120
    or coalesce(length(trim(p_report->>'reason')),0) not between 1 and 500
    or coalesce(length(trim(p_report->>'evidence')),0) not between 1 and 5000
    then return jsonb_build_object('ok',false,'error','INVALID_REPORT','status',400); end if;
  perform pg_advisory_xact_lock(hashtextextended('report:' || p_rate_key,0));
  if exists(select 1 from public.moderation_reports where rate_key=p_rate_key and created_at > clock_timestamp()-interval '60 seconds') then
    return jsonb_build_object('ok',false,'error','Please wait a minute before submitting another report.','status',429);
  end if;
  v_target := nullif(p_report->>'targetKey','');
  if nullif(p_report->>'chatMessageId','') is not null then
    select author_key into v_target from public.community_chat_messages where id=(p_report->>'chatMessageId')::uuid;
    if not found then return jsonb_build_object('ok',false,'error','CHAT_MESSAGE_NOT_FOUND','status',400); end if;
  end if;
  if v_target is not null then
    if not exists(select 1 from public.account_usernames where provider || ':' || account_id = v_target) then
      return jsonb_build_object('ok',false,'error','Account not found. Clear the account ID to report by name.','status',400);
    end if;
  else
    select array_agg(provider || ':' || account_id) into v_matches from public.account_usernames where lower(username)=lower(trim(p_report->>'reportedPlayer'));
    if array_length(v_matches,1)=1 then v_target:=v_matches[1]; end if;
  end if;
  v_reference := 'TC-' || upper(replace(gen_random_uuid()::text,'-',''));
  insert into public.moderation_reports(reference,reporter,rate_key,reported_player,target_key,chat_message_id,location,reason,evidence)
    values(v_reference,p_reporter,p_rate_key,trim(p_report->>'reportedPlayer'),v_target,nullif(p_report->>'chatMessageId','')::uuid,trim(p_report->>'server'),trim(p_report->>'reason'),trim(p_report->>'evidence'));
  return jsonb_build_object('ok',true,'reference',v_reference);
end; $$;

create or replace function public.moderation_access(p_keys text[])
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('ok',true,'serverTime',clock_timestamp(),'bans',coalesce((
    select jsonb_agg(jsonb_build_object('account_key',account_key,'reason',reason,'expires_at',expires_at))
    from public.player_bans where account_key=any(p_keys) and revoked_at is null and (expires_at is null or expires_at>clock_timestamp())
  ),'[]'::jsonb));
$$;

create or replace function public.moderation_overview(p_query text default '')
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('ok',true,'serverTime',clock_timestamp(),
    'reports',coalesce((select jsonb_agg((to_jsonb(r)-'rate_key') || jsonb_build_object('chatMessage',(select jsonb_build_object('body',c.body,'displayName',c.display_name,'createdAt',c.created_at,'hiddenAt',c.hidden_at) from public.community_chat_messages c where c.id=r.chat_message_id))) from (select * from public.moderation_reports
      where trim(p_query)='' or reference=trim(p_query) or target_key=trim(p_query) or strpos(lower(reported_player),lower(trim(p_query)))>0
      order by case when status in ('received','reviewing') then 0 else 1 end, created_at desc limit 100) r),'[]'::jsonb),
    'bans',coalesce((select jsonb_agg(to_jsonb(b)) from (select * from public.player_bans where revoked_at is null and (expires_at is null or expires_at>clock_timestamp()) order by created_at desc limit 100) b),'[]'::jsonb),
    'actions',coalesce((select jsonb_agg(to_jsonb(a)) from (select * from public.moderation_actions order by id desc limit 50) a),'[]'::jsonb),
    'chatMessages',coalesce((select jsonb_agg(to_jsonb(c)) from (select * from public.community_chat_messages where hidden_at is null order by created_at desc limit 50) c),'[]'::jsonb),
    'accounts',coalesce((select jsonb_agg(to_jsonb(u)) from (select provider || ':' || account_id as account_key, username from public.account_usernames
      where length(trim(p_query))>=2 and (strpos(lower(coalesce(username,'')),lower(trim(p_query)))>0 or provider || ':' || account_id=trim(p_query))
      order by provider, account_id limit 20) u),'[]'::jsonb));
$$;

create or replace function public.moderation_apply_action(p_actor text, p_target text, p_action text, p_hours integer, p_reason text, p_report text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_target text := nullif(p_target,''); v_report public.moderation_reports%rowtype; v_expiry timestamptz; v_now timestamptz;
begin
  if p_actor is null or p_actor !~ '^(google:[A-Za-z0-9_-]{1,160}|steam:[0-9]{17})$'
    or p_action is null or p_action not in ('review','dismiss','resolve','temp_ban','ban','unban')
    or coalesce(length(trim(p_reason)),0) not between 5 and 1000 then
    return jsonb_build_object('ok',false,'error','Choose an action and provide a reason (5–1000 characters).','status',400); end if;
  if p_report is not null then
    select * into v_report from public.moderation_reports where reference=p_report for update;
    if not found then return jsonb_build_object('ok',false,'error','REPORT_NOT_FOUND','status',404); end if;
    if v_report.target_key is not null and v_target is not null and v_target<>v_report.target_key then
      return jsonb_build_object('ok',false,'error','REPORT_ACCOUNT_MISMATCH','status',409); end if;
    v_target:=coalesce(v_report.target_key,v_target);
  end if;
  if v_target is not null and not exists(select 1 from public.account_usernames where provider || ':' || account_id=v_target) then
    return jsonb_build_object('ok',false,'error','Select a verified account.','status',400); end if;
  if p_action in ('ban','temp_ban','unban') then
    if v_target=p_actor then return jsonb_build_object('ok',false,'error','Cannot ban your own account.','status',400); end if;
    if v_target is null or not exists(select 1 from public.account_usernames where provider || ':' || account_id=v_target) then
      return jsonb_build_object('ok',false,'error','Select a verified account before applying a ban.','status',400); end if;
    if p_action='temp_ban' and (p_hours is null or p_hours not between 1 and 8760) then
      return jsonb_build_object('ok',false,'error','Temporary bans must last 1–8760 hours.','status',400); end if;
    perform pg_advisory_xact_lock(hashtextextended('ban:' || v_target,0));
  elsif p_report is null then return jsonb_build_object('ok',false,'error','Select a report.','status',400);
  end if;
  v_now:=clock_timestamp();
  if p_action in ('ban','temp_ban') then
    if p_action='temp_ban' then v_expiry:=v_now+make_interval(hours=>p_hours); end if;
    insert into public.player_bans(account_key,reason,expires_at,actor,created_at,revoked_at) values(v_target,trim(p_reason),v_expiry,p_actor,v_now,null)
    on conflict(account_key) do update set reason=excluded.reason,expires_at=excluded.expires_at,actor=excluded.actor,created_at=excluded.created_at,revoked_at=null;
  elsif p_action='unban' then
    update public.player_bans set revoked_at=v_now where account_key=v_target and revoked_at is null;
    if not found then return jsonb_build_object('ok',false,'error','No current ban to revoke.','status',409); end if;
  end if;
  if p_report is not null then
    update public.moderation_reports set target_key=v_target, reviewed_at=v_now,
      status=case when p_action='review' then 'reviewing' when p_action='dismiss' then 'dismissed' else 'resolved' end where reference=p_report;
  end if;
  insert into public.moderation_actions(actor,target_key,report_reference,action,reason,expires_at,created_at)
    values(p_actor,v_target,p_report,p_action,trim(p_reason),v_expiry,v_now);
  return jsonb_build_object('ok',true,'targetKey',v_target,'expiresAt',v_expiry,'action',p_action);
end; $$;
revoke all on function public.moderation_submit_report(jsonb,jsonb,text), public.moderation_access(text[]), public.moderation_overview(text), public.moderation_apply_action(text,text,text,integer,text,text) from public, anon, authenticated;
grant execute on function public.moderation_submit_report(jsonb,jsonb,text), public.moderation_access(text[]), public.moderation_overview(text), public.moderation_apply_action(text,text,text,integer,text,text) to service_role;

-- Preserve reports filed through the earlier form, if its optional table exists.
-- JSON projection handles old camelCase columns without relying on their SQL casing.
do $$ begin
  if to_regclass('public.player_reports') is not null then
    execute $legacy$
      insert into public.moderation_reports(reference,reporter,rate_key,reported_player,target_key,location,reason,evidence,status,created_at)
      select raw->>'reference',
        case when raw->'reporter'->>'steamid' is not null then jsonb_build_object('accountKey','steam:' || (raw->'reporter'->>'steamid'),'displayName',raw->'reporter'->>'personaname') else null end,
        'legacy',coalesce(raw->>'reportedPlayer',raw->>'reportedplayer','Unknown player'),null,
        coalesce(raw->>'server','T-Central Hub'),coalesce(raw->>'reason','Legacy report'),coalesce(raw->>'evidence',''),
        case when coalesce(raw->>'moderationStatus',raw->>'moderationstatus') in ('reviewing','resolved','dismissed') then coalesce(raw->>'moderationStatus',raw->>'moderationstatus') else 'received' end,
        coalesce((coalesce(raw->>'createdAt',raw->>'createdat'))::timestamptz,clock_timestamp())
      from (select to_jsonb(r) raw from public.player_reports r) legacy where length(raw->>'reference')>0
      on conflict(reference) do nothing
    $legacy$;
    alter table public.player_reports enable row level security;
    revoke all on public.player_reports from public, anon, authenticated;
  end if;
end $$;

create or replace function public.moderation_hide_chat(p_actor text,p_message uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_target text;
begin
 if p_actor is null or p_actor !~ '^(google:[A-Za-z0-9_-]{1,160}|steam:[0-9]{17})$' or coalesce(length(trim(p_reason)),0) not between 5 and 1000 then return jsonb_build_object('ok',false,'error','Provide a moderation reason (5–1000 characters).','status',400);end if;
 update public.community_chat_messages set hidden_at=clock_timestamp() where id=p_message and hidden_at is null returning author_key into v_target;
 if not found then return jsonb_build_object('ok',false,'error','Chat message is unavailable or already hidden.','status',404);end if;
 insert into public.moderation_actions(actor,target_key,action,reason,chat_message_id) values(p_actor,v_target,'hide_chat',trim(p_reason),p_message);
 return jsonb_build_object('ok',true,'action','hide_chat','targetKey',v_target,'messageId',p_message);
end;$$;
revoke all on function public.moderation_hide_chat(text,uuid,text) from public,anon,authenticated;
grant execute on function public.moderation_hide_chat(text,uuid,text) to service_role;
