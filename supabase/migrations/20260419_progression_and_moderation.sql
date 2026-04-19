create table if not exists public.player_progression (
  identity_id text primary key,
  display_name text not null,
  identity_kind text not null default 'guest',
  authenticated boolean not null default false,
  progress jsonb not null default '{}'::jsonb,
  progression jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now()
);

alter table if exists public.player_reports
  add column if not exists moderationStatus text,
  add column if not exists statusLabel text,
  add column if not exists moderationStage text,
  add column if not exists severity text,
  add column if not exists severityLabel text,
  add column if not exists reviewedAt timestamptz,
  add column if not exists actionTaken text;
