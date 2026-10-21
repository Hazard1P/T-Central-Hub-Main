-- API writes authenticate Steam/Google sessions and use the server service role.
-- Never expose full author JSON through a browser database client.
alter table public.hub_posts add column if not exists subheading text not null default '';
alter table public.hub_posts drop constraint if exists hub_posts_subheading_length_check;
alter table public.hub_posts add constraint hub_posts_subheading_length_check check (char_length(subheading) <= 180);
alter table public.hub_posts enable row level security;
revoke all on public.hub_posts from anon, authenticated;
grant select, insert, update, delete on public.hub_posts to service_role;
