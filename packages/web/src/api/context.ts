import { createDb } from '@droidvibe/db';
import { env } from '../env.js';

export const db = createDb(env.tursoUrl, env.tursoAuthToken);

export function makeContext(headers: Headers): { ctx: import('../rpc.js').RpcContext } {
  // In production this validates a session/JWT. For now the user id is taken
  // from the X-DroidVibe-User header, defaulting to a local dev user.
  const userId = headers.get('x-droidvibe-user') ?? 'local-user';
  return { ctx: { userId } };
}
