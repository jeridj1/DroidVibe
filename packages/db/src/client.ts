import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';

export function createDb(url?: string, authToken?: string) {
  const client = createClient({
    url: url ?? process.env.TURSO_DATABASE_URL ?? 'file:local.db',
    authToken: authToken ?? process.env.TURSO_AUTH_TOKEN,
  });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
export { schema };
