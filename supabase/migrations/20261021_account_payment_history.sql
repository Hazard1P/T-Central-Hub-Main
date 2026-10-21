-- Private financial records. Browser roles never receive these tables or RPCs.
create table if not exists public.account_payment_intents (
  id uuid primary key default gen_random_uuid(),
  provider_environment text not null default 'live' check (provider_environment in ('live','sandbox','unknown')),
  account_provider text not null check (account_provider in ('steam','google')),
  account_id text not null check (length(account_id) between 1 and 160),
  client_key text not null,
  mode text not null check (mode in ('order','subscription')),
  kind text not null check (kind in ('donation','support_subscription','vip_purchase')),
  focus text not null default 'general' check (focus in ('general','development','marketing','hardware')),
  amount_minor bigint not null check (amount_minor between 1 and 1000000000),
  currency text not null check (currency in ('AUD','BRL','CAD','CHF','CZK','DKK','EUR','GBP','HKD','HUF','ILS','JPY','MXN','MYR','NOK','NZD','PHP','PLN','SEK','SGD','THB','TWD','USD')),
  product jsonb not null default '{}'::jsonb,
  provider_id text unique,
  created_at timestamptz not null default now(),
  unique (account_provider, account_id, client_key)
);
create table if not exists public.account_payment_charges (
  transaction_id text primary key,
  intent_id uuid not null references public.account_payment_intents(id),
  amount_minor bigint not null check (amount_minor between 1 and 1000000000),
  currency text not null,
  paid_at timestamptz not null,
  recorded_at timestamptz not null default now()
);
create table if not exists public.account_payment_adjustments (
  adjustment_id text primary key,
  transaction_id text not null references public.account_payment_charges(transaction_id),
  kind text not null check (kind in ('refund','reversal')),
  amount_minor bigint not null check (amount_minor >= 0),
  created_at timestamptz not null default now()
);
create table if not exists public.account_payment_events (
  provider_environment text not null default 'live' check (provider_environment in ('live','sandbox')),
  event_id text not null,
  event_type text not null,
  provider_reference text,
  outcome text not null,
  received_at timestamptz not null default now(),
  primary key(provider_environment,event_id)
);
create table if not exists public.account_payment_benefits (
  transaction_id text not null references public.account_payment_charges(transaction_id),
  benefit_key text not null,
  terms_snapshot jsonb not null,
  status text not null default 'pending' check (status in ('pending','fulfilled','revoked')),
  updated_at timestamptz not null default now(),
  primary key (transaction_id, benefit_key)
);
create index if not exists account_payment_owner_idx on public.account_payment_intents(account_provider, account_id);
create index if not exists account_payment_charge_intent_idx on public.account_payment_charges(intent_id);
create index if not exists account_payment_adjustment_charge_idx on public.account_payment_adjustments(transaction_id);

create or replace function public.protect_account_payment_intent() returns trigger language plpgsql as $$
begin
  if row(new.account_provider,new.account_id,new.client_key,new.mode,new.kind,new.focus,new.amount_minor,new.currency,new.product)
     is distinct from row(old.account_provider,old.account_id,old.client_key,old.mode,old.kind,old.focus,old.amount_minor,old.currency,old.product)
     or (new.provider_environment is distinct from old.provider_environment and old.provider_environment <> 'unknown')
     or (old.provider_id is not null and new.provider_id is distinct from old.provider_id) then
    raise exception 'Payment ownership and purchase snapshot are immutable';
  end if;
  return new;
end $$;
drop trigger if exists protect_account_payment_intent_trigger on public.account_payment_intents;
create trigger protect_account_payment_intent_trigger before update on public.account_payment_intents for each row execute function public.protect_account_payment_intent();

create or replace function public.protect_account_payment_history() returns trigger language plpgsql as $$
begin raise exception 'Financial history is append-only'; end $$;
drop trigger if exists protect_payment_charge_history on public.account_payment_charges;
create trigger protect_payment_charge_history before update or delete on public.account_payment_charges for each row execute function public.protect_account_payment_history();
drop trigger if exists protect_payment_adjustment_history on public.account_payment_adjustments;
create trigger protect_payment_adjustment_history before update or delete on public.account_payment_adjustments for each row execute function public.protect_account_payment_history();

create or replace function public.record_account_payment(p_intent uuid,p_transaction text,p_amount bigint,p_currency text,p_paid_at timestamptz,p_environment text default 'live')
returns jsonb language plpgsql set search_path = public as $$
declare intent account_payment_intents; existing account_payment_charges; benefit jsonb;
begin
  select * into strict intent from account_payment_intents where id=p_intent for update;
  if p_environment not in ('live','sandbox') or (intent.provider_environment <> 'unknown' and intent.provider_environment <> p_environment) then raise exception 'Payment environment mismatch'; end if;
  if intent.provider_environment='unknown' then update account_payment_intents set provider_environment=p_environment where id=p_intent;intent.provider_environment:=p_environment;end if;
  if intent.provider_id is null or intent.amount_minor<>p_amount or intent.currency<>p_currency then raise exception 'Payment does not match intent'; end if;
  select * into existing from account_payment_charges where transaction_id=p_transaction;
  if found then
    if existing.intent_id<>p_intent or existing.amount_minor<>p_amount or existing.currency<>p_currency then raise exception 'Transaction binding conflict'; end if;
    return jsonb_build_object('replay',true);
  end if;
  if intent.mode='order' and exists(select 1 from account_payment_charges where intent_id=p_intent) then raise exception 'Order already paid'; end if;
  insert into account_payment_charges(transaction_id,intent_id,amount_minor,currency,paid_at) values(p_transaction,p_intent,p_amount,p_currency,p_paid_at);
  if intent.kind='vip_purchase' and intent.provider_environment='live' then
    for benefit in select value from jsonb_array_elements(coalesce(intent.product->'benefits','[]'::jsonb)) loop
      insert into account_payment_benefits(transaction_id,benefit_key,terms_snapshot) values(p_transaction,benefit->>'key',benefit);
    end loop;
  end if;
  return jsonb_build_object('replay',false);
end $$;

create or replace function public.adjust_account_payment(p_transaction text,p_adjustment text,p_kind text,p_amount bigint,p_currency text,p_environment text default 'live')
returns jsonb language plpgsql set search_path=public as $$
declare charge account_payment_charges; existing account_payment_adjustments; adjusted bigint; value_to_record bigint;
begin
  select * into strict charge from account_payment_charges where transaction_id=p_transaction for update;
  if not exists(select 1 from account_payment_intents where id=charge.intent_id and provider_environment=p_environment) then raise exception 'Payment adjustment environment mismatch'; end if;
  if p_kind not in ('refund','reversal') or p_amount<=0 or p_currency<>charge.currency then raise exception 'Invalid payment adjustment'; end if;
  select * into existing from account_payment_adjustments where adjustment_id=p_adjustment;
  if found then
    if existing.transaction_id<>p_transaction or existing.kind<>p_kind or (p_kind='refund' and existing.amount_minor<>p_amount) then raise exception 'Adjustment binding conflict'; end if;
    return jsonb_build_object('replay',true);
  end if;
  select coalesce(sum(amount_minor),0) into adjusted from account_payment_adjustments where transaction_id=p_transaction;
  if p_kind='reversal' then
    if p_amount<>charge.amount_minor then raise exception 'Reversal does not match capture'; end if;
    value_to_record:=charge.amount_minor-adjusted;
  else value_to_record:=p_amount; end if;
  if value_to_record<0 or adjusted+value_to_record>charge.amount_minor then raise exception 'Adjustment exceeds payment'; end if;
  insert into account_payment_adjustments(adjustment_id,transaction_id,kind,amount_minor) values(p_adjustment,p_transaction,p_kind,value_to_record);
  -- Conservative: paid VIP benefits require review after any refund/reversal.
  update account_payment_benefits set status='revoked',updated_at=now() where transaction_id=p_transaction;
  return jsonb_build_object('replay',false);
end $$;

create or replace function public.account_payment_summary(p_provider text,p_account_id text,p_environment text default 'live')
returns jsonb language sql stable set search_path=public as $$
with refunds as (select transaction_id,sum(amount_minor) refunded,bool_or(kind='reversal') reversed from account_payment_adjustments group by transaction_id),
entries as (
 select c.*,i.kind,i.focus,i.product,i.mode,coalesce(r.refunded,0) refunded,coalesce(r.reversed,false) reversed
 from account_payment_charges c join account_payment_intents i on i.id=c.intent_id left join refunds r using(transaction_id)
 where i.provider_environment=p_environment and (p_provider is null or i.account_provider=p_provider) and (p_account_id is null or i.account_id=p_account_id)
), totals as (
 select currency,count(*) payments,sum(amount_minor)::text gross_minor,sum(refunded)::text refunded_minor,(sum(amount_minor)-sum(refunded))::text net_minor from entries group by currency
), groups as (
 select currency,kind,focus,count(*) payments,sum(amount_minor-refunded)::text net_minor from entries group by currency,kind,focus
), recent as (
 select e.transaction_id,e.kind,e.focus,e.currency,e.amount_minor::text amount_minor,e.refunded::text refunded_minor,e.paid_at,e.product->>'name' description,
 case when e.reversed then 'reversed' when e.refunded=e.amount_minor then 'refunded' when e.refunded>0 then 'partially_refunded' else 'paid' end status
 from entries e order by paid_at desc,transaction_id limit 50
)
select jsonb_build_object(
 'totals',coalesce((select jsonb_agg(to_jsonb(t) order by currency) from totals t),'[]'::jsonb),
 'groups',coalesce((select jsonb_agg(to_jsonb(g) order by currency,kind,focus) from groups g),'[]'::jsonb),
 'recent',coalesce((select jsonb_agg(to_jsonb(r) order by paid_at desc,transaction_id) from recent r),'[]'::jsonb),
 'paymentCount',(select count(*) from entries),
 'benefits',coalesce((select jsonb_agg(jsonb_build_object('transactionId',b.transaction_id,'key',b.benefit_key,'status',b.status,'terms',b.terms_snapshot)) from account_payment_benefits b join entries e using(transaction_id)),'[]'::jsonb)
);
$$;

-- Preserve owned legacy intents; import only verified completed captures. Legacy
-- subscription status/approval is not evidence of an actual monetary payment.
insert into public.account_payment_intents(provider_environment,account_provider,account_id,client_key,mode,kind,amount_minor,currency,product,provider_id)
select 'unknown','steam',steamid,'legacy:'||order_id,'order','donation',
 round(coalesce(capture_amount,amount)*case when coalesce(capture_currency,currency) in ('JPY','HUF','TWD') then 1 else 100 end)::bigint,coalesce(capture_currency,currency),
 '{"name":"Historical verified contribution","version":1,"legacy":true,"benefits":[]}'::jsonb,order_id
from public.tcentral_donations where coalesce(capture_amount,amount)>0 and coalesce(capture_amount,amount)<=10000 and coalesce(capture_currency,currency) in ('AUD','BRL','CAD','CHF','CZK','DKK','EUR','GBP','HKD','HUF','ILS','JPY','MXN','MYR','NOK','NZD','PHP','PLN','SEK','SGD','THB','TWD','USD')
on conflict do nothing;
insert into public.account_payment_charges(transaction_id,intent_id,amount_minor,currency,paid_at)
select d.capture_id,i.id,i.amount_minor,i.currency,coalesce(d.captured_at,d.updated_at)
from public.tcentral_donations d join public.account_payment_intents i on i.provider_id=d.order_id and i.client_key='legacy:'||d.order_id
where d.status='CONFIRMED' and d.capture_status='COMPLETED' and d.capture_id is not null
on conflict do nothing;

do $$ declare name text; begin
 foreach name in array array['account_payment_intents','account_payment_charges','account_payment_adjustments','account_payment_events','account_payment_benefits'] loop
  execute format('alter table public.%I enable row level security',name);
  execute format('revoke all on public.%I from public,anon,authenticated',name);
  execute format('grant select,insert,update on public.%I to service_role',name);
 end loop;
end $$;
revoke all on function public.record_account_payment(uuid,text,bigint,text,timestamptz,text) from public,anon,authenticated;
revoke all on function public.adjust_account_payment(text,text,text,bigint,text,text) from public,anon,authenticated;
revoke all on function public.account_payment_summary(text,text,text) from public,anon,authenticated;
grant execute on function public.record_account_payment(uuid,text,bigint,text,timestamptz,text) to service_role;
grant execute on function public.adjust_account_payment(text,text,text,bigint,text,text) to service_role;
grant execute on function public.account_payment_summary(text,text,text) to service_role;
