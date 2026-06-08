import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationsRoot = path.join(root, 'supabase', 'migrations');
const duplicateCreateChecks = [
  {
    table: 'public.player_account_ledger',
    pattern: /create\s+table\s+if\s+not\s+exists\s+public\.player_account_ledger\b/gi,
  },
];

async function readMigrationFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

const migrationFiles = await readMigrationFiles(migrationsRoot);
const issues = [];

for (const check of duplicateCreateChecks) {
  const declarations = [];

  for (const file of migrationFiles) {
    const sql = await fs.readFile(file, 'utf8');
    const matches = sql.match(check.pattern) || [];
    for (const _match of matches) declarations.push(path.relative(root, file));
  }

  if (declarations.length > 1) {
    issues.push(`${check.table} has ${declarations.length} create table declarations: ${declarations.join(', ')}`);
  }
}

if (issues.length > 0) {
  console.error('Supabase migration verification failed:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Verified ${migrationFiles.length} Supabase migrations without duplicate guarded table declarations.`);
