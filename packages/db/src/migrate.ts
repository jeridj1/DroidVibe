/**
 * Apply generated Drizzle migrations to the configured Turso database.
 * Run with: pnpm --filter @droidvibe/db migrate
 */
import { createClient } from '@libsql/client';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

async function main() {
  const url = process.env.TURSO_DATABASE_URL ?? 'file:local.db';
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, authToken });

  await client.execute(
    'CREATE TABLE IF NOT EXISTS droidvibe_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER DEFAULT (unixepoch()))',
  );

  const dir = new URL('../drizzle', import.meta.url).pathname;
  let files: string[] = [];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
  } catch {
    console.log('No migrations directory found. Run pnpm --filter @droidvibe/db generate first.');
    return;
  }

  for (const file of files) {
    const applied = await client.execute({
      sql: 'SELECT 1 FROM droidvibe_migrations WHERE name = ?',
      args: [file],
    });
    if (applied.rows.length > 0) {
      console.log('skip (applied):', file);
      continue;
    }
    const sql = readFileSync(join(dir, file), 'utf8');
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await client.execute(stmt);
    }
    await client.execute({ sql: 'INSERT INTO droidvibe_migrations (name) VALUES (?)', args: [file] });
    console.log('applied:', file);
  }
  console.log('Migrations complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
