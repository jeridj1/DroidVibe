import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { z } from 'zod';
import { appRouter } from './api/router.js';
import { makeContext } from './api/context.js';
import { env } from './env.js';

const app = new Hono();

app.get('/health', (c) => c.json({ ok: true, service: 'droidvibe-web', time: Date.now() }));

/**
 * Generic typed RPC dispatcher: POST /rpc/<namespace>/<procedure> with a JSON
 * body. Procedures are resolved from the router; Zod validates input.
 */
app.post('/rpc/*', async (c) => {
  const path = c.req.path.replace('/rpc/', '');
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return c.json({ error: 'not found' }, 404);

  // Walk the router to find the procedure.
  let node: unknown = appRouter;
  for (const p of parts) {
    if (node && typeof node === 'object' && p in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[p];
    } else {
      return c.json({ error: 'not found', path }, 404);
    }
  }
  if (typeof node !== 'object' || node === null || !('handler' in (node as object))) {
    return c.json({ error: 'not a procedure', path }, 404);
  }
  const proc = node as { input: z.ZodTypeAny; handler: (a: { input: unknown; ctx: { userId: string } }) => Promise<unknown> };

  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    json = undefined;
  }
  const parsed = proc.input.safeParse(json);
  if (!parsed.success) return c.json({ error: 'bad input', issues: parsed.error.issues }, 400);

  const { ctx } = makeContext(c.req.raw.headers);
  try {
    const result = await proc.handler({ input: parsed.data, ctx });
    return c.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: message }, 500);
  }
});

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log('DroidVibe web backend listening on http://localhost:' + info.port);
});
