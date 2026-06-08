import { readFile } from 'node:fs/promises';

const checks = [];

async function file(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function assertCheck(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition), detail });
}

const migration = await file('supabase/migrations/20260608_matrixcoinexchange_persistence.sql');
const store = await file('lib/server/matrixCoinExchangeStore.js');
const route = await file('app/api/matrixcoinexchange/system/route.js');
const stableWorld = await file('components/StableSystemWorld.js');

assertCheck(
  'MatrixCoinExchange migration creates dedicated tables',
  /create table if not exists public\.matrixcoin_wallets/i.test(migration)
    && /create table if not exists public\.matrixcoin_ledger_entries/i.test(migration)
    && /create table if not exists public\.matrixcoin_settlements/i.test(migration),
  'Expected matrixcoin_wallets, matrixcoin_ledger_entries, and matrixcoin_settlements tables.',
);

assertCheck(
  'MatrixCoinExchange tables are scoped to the matrixcoinexchange node',
  /node_key text not null default 'matrixcoinexchange'/i.test(migration)
    && /check \(node_key = 'matrixcoinexchange'\)/i.test(migration),
  'Expected node_key defaults and check constraints for matrixcoinexchange.',
);

assertCheck(
  'Ledger idempotency is enforced outside player progression',
  /matrixcoin_ledger_entries_idempotency_key_idx/i.test(migration)
    && /MATRIXCOIN_LEDGER_TABLE = 'matrixcoin_ledger_entries'/.test(store)
    && /idempotencyKey/.test(store),
  'Expected unique matrixcoin ledger idempotency and store-level idempotency handling.',
);

assertCheck(
  'Store never uses player_progression as MatrixCoinExchange ledger',
  !/player_progression/.test(store)
    && !/player_account_ledger/.test(store),
  'MatrixCoinExchange store must use matrixcoin_* tables rather than generic progression tables.',
);

assertCheck(
  'Settlement API records server-side MatrixCoinExchange settlements',
  /export async function POST/.test(route)
    && /recordMatrixCoinSettlement/.test(route)
    && /AUTHENTICATED_ACCOUNT_REQUIRED/.test(route),
  'Expected authenticated POST route that calls recordMatrixCoinSettlement.',
);

assertCheck(
  'StableSystemWorld posts MatrixCoinExchange settlements to the API',
  /fetch\('\/api\/matrixcoinexchange\/system'/.test(stableWorld)
    && /nodeKey: 'matrixcoinexchange'/.test(stableWorld)
    && /idempotencyKey/.test(stableWorld),
  'Expected client settlement flow to post node-scoped, idempotent settlement data.',
);

const failures = checks.filter((check) => !check.ok);
for (const check of checks) {
  const prefix = check.ok ? 'PASS' : 'FAIL';
  console.log(`${prefix} ${check.name} - ${check.detail}`);
}

if (failures.length) {
  process.exitCode = 1;
}
