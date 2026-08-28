import { router } from '../rpc.js';
import { compile } from './routes/compile.js';
import * as diagnostics from './routes/diagnostics.js';
import * as boards from './routes/boards.js';
import * as libraries from './routes/libraries.js';
import * as sketches from './routes/sketches.js';
import * as ai from './routes/ai.js';
import * as examples from './routes/examples.js';

export const appRouter = router({
  compile,
  diagnostics: { explain: diagnostics.explain },
  boards: { list: boards.list, install: boards.install },
  libraries: { list: libraries.list, install: libraries.install },
  sketches: {
    create: sketches.create,
    list: sketches.list,
    get: sketches.get,
    save: sketches.save,
    snapshot: sketches.snapshot,
  },
  ai: { explainError: ai.explainError, generate: ai.generate, fix: ai.fix },
  examples: { list: examples.list, get: examples.get },
});
