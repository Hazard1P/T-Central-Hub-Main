-- Additive: existing plaintext records remain readable until explicitly migrated.
alter table public.account_prayer_seeds add column if not exists body_ciphertext text;
alter table public.account_prayer_seeds drop constraint if exists account_prayer_seeds_ciphertext_check;
alter table public.account_prayer_seeds add constraint account_prayer_seeds_ciphertext_check
 check(body_ciphertext is null or (body='[encrypted]' and body_ciphertext ~ '^v3\.[A-Za-z0-9_-]{1,32}\.[A-Za-z0-9_-]+$' and length(body_ciphertext)<8192));
grant update on public.account_prayer_seeds to service_role;
