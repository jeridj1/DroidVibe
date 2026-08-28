import { z } from 'zod';
import { procedure } from '../../rpc.js';
import { explainDiagnostics } from '@droidvibe/shared';
import type { Diagnostic } from '@droidvibe/shared';

const ExplainInput = z.object({
  diagnostics: z.array(
    z.object({
      severity: z.enum(['error', 'warning', 'info']),
      file: z.string(),
      line: z.number(),
      column: z.number(),
      message: z.string(),
      code: z.string().optional(),
    }),
  ),
});

export const explain = procedure(ExplainInput, async ({ input }) => {
  const explained = explainDiagnostics(input.diagnostics as Diagnostic[]);
  return { diagnostics: explained };
});
