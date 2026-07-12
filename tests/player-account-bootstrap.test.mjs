import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const serverPersistence = readFileSync(new URL('../lib/serverPersistence.js', import.meta.url), 'utf8');
const steamCallback = readFileSync(new URL('../app/api/auth/steam/callback/route.js', import.meta.url), 'utf8');
const googleCallback = readFileSync(new URL('../app/api/auth/google/callback/route.js', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/20260607_player_accounts.sql', import.meta.url), 'utf8');

test('player_accounts migration supports provider-agnostic account identities', () => {
  assert.match(migration, /provider text not null default 'steam'/);
  assert.match(migration, /account_id text/);
  assert.match(migration, /set account_id = steam_id/s);
  assert.match(migration, /alter column steam_id drop not null/);
  assert.match(migration, /player_accounts_provider_account_id_idx\s*\n  on public\.player_accounts \(provider, account_id\);/);
});

test('generic account bootstrap upserts durable Steam and Google player account records', () => {
  assert.match(serverPersistence, /export async function ensurePlayerAccountForLogin/);
  assert.match(serverPersistence, /\.from\('player_accounts'\)/);
  assert.match(serverPersistence, /\.upsert\(accountRecord, \{ onConflict: 'provider,account_id' \}\)/);
  assert.match(serverPersistence, /provider: profile\.provider/);
  assert.match(serverPersistence, /account_id: profile\.account_id/);
  assert.match(serverPersistence, /steam_id: profile\.steam_id/);
  assert.match(serverPersistence, /metadata: profile\.metadata/);
});

test('Steam and Google callbacks share the generic account bootstrap path', () => {
  assert.match(steamCallback, /import \{ ensurePlayerAccountForLogin \}/);
  assert.match(steamCallback, /provider: 'steam'/);
  assert.match(steamCallback, /accountId: user\.steamid/);
  assert.match(steamCallback, /profileUrl: user\.profileurl/);
  assert.match(googleCallback, /import \{ ensurePlayerAccountForLogin \}/);
  assert.match(googleCallback, /provider: 'google'/);
  assert.match(googleCallback, /accountId: user\.sub/);
  assert.match(googleCallback, /email: user\.email \|\| null/);
  assert.match(googleCallback, /picture: user\.picture \|\| null/);
});
