-- Private storage; public chat responses use an explicit field allowlist.
create table if not exists public.community_chat_messages (
  id uuid primary key default gen_random_uuid(),
  author_key text not null,
  display_name text not null,
  provider text not null check(provider in ('google','steam')),
  body text not null check(char_length(body) between 1 and 500),
  created_at timestamptz not null default clock_timestamp(),
  hidden_at timestamptz
);
create index if not exists community_chat_recent_idx on public.community_chat_messages(created_at desc);
create index if not exists community_chat_author_idx on public.community_chat_messages(author_key,created_at desc);
alter table public.community_chat_messages enable row level security;
revoke all on public.community_chat_messages from public, anon, authenticated;
grant all on public.community_chat_messages to service_role;
create or replace function public.community_chat_history()
returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object('ok',true,'messages',coalesce((select jsonb_agg(jsonb_build_object('id',id,'displayName',display_name,'provider',provider,'body',body,'createdAt',created_at) order by created_at asc)
 from (select * from public.community_chat_messages where hidden_at is null order by created_at desc limit 50) m),'[]'::jsonb));
$$;
create or replace function public.community_chat_post(p_author text,p_name text,p_body text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_message public.community_chat_messages%rowtype;v_now timestamptz;
begin
 if p_author is null or p_author !~ '^(google:[A-Za-z0-9_-]{1,160}|steam:[0-9]{17})$' or coalesce(length(trim(p_name)),0) not between 1 and 160 or coalesce(length(trim(p_body)),0) not between 1 and 500 then return jsonb_build_object('ok',false,'error','Invalid chat message.','status',400);end if;
 perform pg_advisory_xact_lock(hashtextextended('chat:'||p_author,0));v_now:=clock_timestamp();
 if exists(select 1 from public.player_bans where account_key=p_author and revoked_at is null and (expires_at is null or expires_at>v_now)) then return jsonb_build_object('ok',false,'error','ACCOUNT_BANNED','status',403);end if;
 if exists(select 1 from public.community_chat_messages where author_key=p_author and created_at>v_now-interval '2 seconds')
 or (select count(*) from public.community_chat_messages where author_key=p_author and created_at>v_now-interval '30 seconds')>=5 then return jsonb_build_object('ok',false,'error','Please slow down and try again shortly.','status',429);end if;
 insert into public.community_chat_messages(author_key,display_name,provider,body,created_at) values(p_author,trim(p_name),split_part(p_author,':',1),trim(p_body),v_now) returning * into v_message;
 return jsonb_build_object('ok',true,'message',jsonb_build_object('id',v_message.id,'displayName',v_message.display_name,'provider',v_message.provider,'body',v_message.body,'createdAt',v_message.created_at));
end;$$;
revoke all on function public.community_chat_history(), public.community_chat_post(text,text,text) from public, anon, authenticated;
grant execute on function public.community_chat_history(), public.community_chat_post(text,text,text) to service_role;
