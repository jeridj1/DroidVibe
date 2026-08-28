import { z } from 'zod';
import { procedure } from '../../rpc.js';
import { schema } from '@droidvibe/db';
import { db } from '../context.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const NewSketch = z.object({
  name: z.string(),
  fqbn: z.string().default('arduino:avr:uno'),
  files: z.array(z.object({ path: z.string(), content: z.string(), language: z.string().default('ino') })).default([]),
});

export const create = procedure(NewSketch, async ({ input, ctx }) => {
  const id = nanoid();
  await db.insert(schema.sketches).values({
    id,
    userId: ctx.userId,
    name: input.name,
    fqbn: input.fqbn,
  });
  for (const f of input.files) {
    await db.insert(schema.sketchFiles).values({
      id: nanoid(),
      sketchId: id,
      path: f.path,
      content: f.content,
      language: f.language,
    });
  }
  return { id, name: input.name, fqbn: input.fqbn };
});

const ListInput = z.object({}).optional();
export const list = procedure(ListInput ?? z.object({}), async ({ ctx }) => {
  const rows = await db.select().from(schema.sketches).where(eq(schema.sketches.userId, ctx.userId));
  return { sketches: rows };
});

const GetInput = z.object({ id: z.string() });
export const get = procedure(GetInput, async ({ input, ctx }) => {
  const [sketch] = await db
    .select()
    .from(schema.sketches)
    .where(eq(schema.sketches.id, input.id));
  if (!sketch || sketch.userId !== ctx.userId) return { sketch: null, files: [] };
  const files = await db.select().from(schema.sketchFiles).where(eq(schema.sketchFiles.sketchId, input.id));
  return { sketch, files };
});

const SaveInput = z.object({
  id: z.string(),
  files: z.array(z.object({ path: z.string(), content: z.string(), language: z.string().default('ino') })),
});
export const save = procedure(SaveInput, async ({ input }) => {
  for (const f of input.files) {
    // upsert by sketchId + path (simple model: delete + insert)
    const existing = await db
      .select()
      .
from(schema.sketchFiles)
      .where(eq(schema.sketchFiles.sketchId, input.id));
    const found = existing.find((e) => e.path === f.path);
    if (found) {
      await db
        .update(schema.sketchFiles)
        .set({ content: f.content, language: f.language, updatedAt: new Date() })
        .where(eq(schema.sketchFiles.id, found.id));
    } else {
      await db.insert(schema.sketchFiles).values({
        id: nanoid(),
        sketchId: input.id,
        path: f.path,
        content: f.content,
        language: f.language,
      });
    }
  }
  return { ok: true };
});

const VersionInput = z.object({ id: z.string(), label: z.string().optional() });
export const snapshot = procedure(VersionInput, async ({ input, ctx }) => {
  const files = await db.select().from(schema.sketchFiles).where(eq(schema.sketchFiles.sketchId, input.id));
  const version = await db.insert(schema.sketchVersions).values({
    id: nanoid(),
    sketchId: input.id,
    label: input.label,
    snapshot: JSON.stringify(files.map((f) => ({ path: f.path, content: f.content, language: f.language }))),
  }).returning();
  void ctx;
  return { versionId: version[0]?.id ?? null };
});
