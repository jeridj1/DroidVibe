import { z } from 'zod';
import { procedure } from '../../rpc.js';
import { prepareSketchJob, compileSketch, cleanupJob } from '../../arduino/cli.js';
import { parseArduinoCliJson, explainDiagnostics } from '@droidvibe/shared';
import { schema } from '@droidvibe/db';
import { db } from '../context.js';
import { nanoid } from 'nanoid';

const CompileInput = z.object({
  name: z.string(),
  fqbn: z.string().default('arduino:avr:uno'),
  files: z.array(z.object({ path: z.string(), content: z.string() })),
  persist: z.boolean().default(false),
});

export const compile = procedure(CompileInput, async ({ input, ctx }) => {
  const job = await prepareSketchJob(input.files, input.name);
  try {
    const build = await compileSketch(job.inoPath, input.fqbn);
    const diagnostics = explainDiagnostics(parseArduinoCliJson(build.stdout));
    const buildId = nanoid();

    if (!build.ok) {
      if (input.persist) {
        await db.insert(schema.builds).values({
          id: buildId,
          userId: ctx.userId,
          fqbn: input.fqbn,
          ok: false,
          diagnostics: JSON.stringify(diagnostics),
          firmwarePath: null,
          durationMs: build.durationMs,
        });
      }
      return {
        ok: false,
        diagnostics,
        firmware: undefined,
        firmwarePath: undefined,
        fqbn: input.fqbn,
        durationMs: build.durationMs,
        stdout: build.stdout,
        buildId: input.persist ? buildId : undefined,
      };
    }

    if (input.persist) {
      await db.insert(schema.builds).values({
        id: buildId,
        userId: ctx.userId,
        fqbn: input.fqbn,
        ok: true,
        diagnostics: JSON.stringify(diagnostics),
        firmwarePath: build.firmwarePath ?? null,
        durationMs: build.durationMs,
      });
    }

    return {
      ok: true,
      diagnostics,
      firmware: undefined,
      firmwarePath: build.firmwarePath ?? undefined,
      fqbn: input.fqbn,
      durationMs: build.durationMs,
      stdout: build.stdout,
      buildId: input.persist ? buildId : undefined,
    };
  } finally {
    await cleanupJob(job.jobDir);
  }
});
