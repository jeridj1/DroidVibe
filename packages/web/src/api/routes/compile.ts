import { z } from 'zod';
import { procedure } from '../rpc.js';
import { prepareSketchJob, compileSketch, cleanupJob } from '../../arduino/cli.js';
import { parseArduinoCliJson, explainDiagnostics } from '@droidvibe/shared';
import { env } from '../../env.js';
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
    // On failure, never report ok. Diagnostics explain the real cause.
    if (!build.ok) {
      return {
        ok: false,
        diagnostics,
        firmware: undefined,
        firmwarePath: undefined,
        fqbn: input.fqbn,
        durationMs: build.durationMs,
        stdout: build.stdout,
        buildId: undefined,
      };
    }
    const buildId = nanoid();
    // TODO: persist build record to DB (ctx.userId, buildId) when persist=true.
    void ctx;
    void env;
    return {
      ok: true,
      diagnostics,
      firmware: undefined, // firmware delivered as a signed download URL in prod
      firmwarePath: build.firmwarePath ?? undefined,
      fqbn: input.fqbn,
      durationMs: build.durationMs,
      stdout: build.stdout,
      buildId,
    };
  } finally {
    await cleanupJob(job.jobDir);
  }
});
