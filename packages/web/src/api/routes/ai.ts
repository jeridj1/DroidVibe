import { z } from 'zod';
import { procedure } from '../../rpc.js';
import { env } from '../../env.js';

const ExplainErrorInput = z.object({
  diagnostics: z.array(
    z.object({
      severity: z.enum(['error', 'warning', 'info']),
      file: z.string(),
      line: z.number(),
      column: z.number(),
      message: z.string(),
    }),
  ),
  code: z.string().optional(),
});

const GenerateInput = z.object({
  prompt: z.string(),
  boardFqbn: z.string().default('arduino:avr:uno'),
});

const FixInput = z.object({
  code: z.string(),
  diagnostics: z.array(z.object({ message: z.string(), line: z.number().optional() })),
});

// Markdown code fence, built without literal backticks so this file is safe
// to embed in template strings.
const BTICK = String.fromCharCode(96);
const FENCE = BTICK + BTICK + BTICK;

function extractCode(text: string): string {
  const re = new RegExp(FENCE + '(?:c\+\+|cpp|c|ino)?\n([\s\S]*?)' + FENCE);
  const m = text.match(re);
  return m ? m[1] : text;
}

/**
 * Call the configured chat model. Returns the assistant text. When the API key
 * is unset, returns a helpful, clearly-marked offline response instead of
 * pretending to call an LLM.
 */
async function chat(system: string, user: string): Promise<string> {
  if (!env.aiApiKey) {
    return (
      '[offline] AI is not configured on this backend. Set AI_API_KEY to enable ' +
      'error explanation, sketch generation and code fixing. The structured ' +
      'diagnostics explainer (no AI required) remains available.'
    );
  }
  const res = await fetch(env.aiBaseUrl + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + env.aiApiKey,
    },
    body: JSON.stringify({
      model: env.aiModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) return '[error] AI request failed: ' + res.sta
tus;
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

export const explainError = procedure(ExplainErrorInput, async ({ input }) => {
  const diagText = input.diagnostics
    .map((d) => d.file + ':' + d.line + ':' + d.column + ' [' + d.severity + '] ' + d.message)
    .join('\n');
  const system =
    'You are an Arduino embedded mentor. Explain compiler diagnostics clearly and ' +
    'actionably for a beginner-to-intermediate developer. Keep it concise. ' +
    'Reference line numbers. Do not invent APIs.';
  const text = await chat(system, 'Diagnostics:\n' + diagText + (input.code ? '\n\nCode:\n' + input.code : ''));
  return { explanation: text };
});

export const generate = procedure(GenerateInput, async ({ input }) => {
  const system =
    'You write clean, well-commented Arduino sketches. Output only the .ino code in a ' +
    'single fenced block, targeting the requested board FQBN. Use setup()/loop(). ' +
    'Prefer the Arduino core API; note required libraries in a comment.';
  const text = await chat(system, 'Board: ' + input.boardFqbn + '\nRequest: ' + input.prompt);
  return { code: extractCode(text) };
});

export const fix = procedure(FixInput, async ({ input }) => {
  const system =
    'You fix Arduino sketches given compiler diagnostics. Output only the corrected .ino ' +
    'code in a single fenced block. Preserve intent. Add a brief comment noting what changed.';
  const user =
    'Diagnostics:\n' +
    input.diagnostics.map((d) => 'line ' + (d.line ?? '?') + ': ' + d.message).join('\n') +
    '\n\nCode:\n' +
    input.code;
  const text = await chat(system, user);
  return { code: extractCode(text) };
});
