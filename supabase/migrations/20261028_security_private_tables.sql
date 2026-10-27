-- Verified Google/Steam sessions live in the application, not Supabase's anon role.
-- Private account/support data must be available only to server service credentials.
do $$ declare table_name text;begin
 foreach table_name in array array['player_progression','player_accounts','player_account_ledger','contact_submissions','launch_records','dyson_meter_events','player_reports','account_cyber_intelligence','account_prayer_seeds'] loop
  if to_regclass('public.'||table_name) is not null then
   execute format('alter table public.%I enable row level security',table_name);
   execute format('revoke all on public.%I from public, anon, authenticated',table_name);
   execute format('grant select,insert,update,delete on public.%I to service_role',table_name);
  end if;
 end loop;
end $$;
