-- Requires the existing hub_posts and community_post_headings migrations.
alter table public.hub_posts add column if not exists board text not null default 'general-discussion';
-- Keep the original category as context for legacy posts. Broad server feedback
-- cannot identify Rust versus Arma reliably, so leave it in General discussion.
update public.hub_posts set board = case category
  when 'Bug report' then 'bugs-help' when 'Feature idea' then 'feature-ideas'
  when 'Events' then 'events' when 'Moderation' then 'community-guidelines'
  else 'general-discussion' end
where board='general-discussion' and category in ('Bug report','Feature idea','Events','Moderation');
alter table public.hub_posts drop constraint if exists hub_posts_board_check;
alter table public.hub_posts add constraint hub_posts_board_check check (board in (
  'space-exploration','shipyard-mining','combat-crews','rust-servers','arma-operations','looking-for-group',
  'bugs-help','feature-ideas','graphics-mobile','introductions','events','general-discussion','community-guidelines'
));
create index if not exists hub_posts_board_created_idx on public.hub_posts(board,"createdAt" desc);
