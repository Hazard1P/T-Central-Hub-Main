create table if not exists public.hub_posts (
  reference text primary key,
  topic text not null,
  category text not null default 'General',
  message text not null,
  "createdAt" timestamptz not null default now(),
  author jsonb not null default '{}'::jsonb,
  source text not null default 'hub-community-form',
  visibility text not null default 'community',
  status text not null default 'published',
  constraint hub_posts_topic_length_check check (char_length(topic) between 1 and 120),
  constraint hub_posts_message_length_check check (char_length(message) between 1 and 3000),
  constraint hub_posts_category_check check (category in ('General', 'Server feedback', 'Bug report', 'Events', 'Feature idea', 'Moderation')),
  constraint hub_posts_provider_check check ((author->>'provider') in ('steam', 'google')),
  constraint hub_posts_account_check check (coalesce(author->>'accountId', author->>'steamid', author->>'googleSub') is not null)
);

create index if not exists hub_posts_created_at_idx on public.hub_posts ("createdAt" desc);
create index if not exists hub_posts_category_created_at_idx on public.hub_posts (category, "createdAt" desc);
create index if not exists hub_posts_author_provider_idx on public.hub_posts ((author->>'provider'));
create index if not exists hub_posts_author_account_idx on public.hub_posts ((author->>'accountId'));
