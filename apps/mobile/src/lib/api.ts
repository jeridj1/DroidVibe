/**
 * Typed RPC client for the DroidVibe backend. Calls POST /rpc/<ns>/<proc> with
 * a JSON body. Falls back to an offline/mock response when the backend is
 * unreachable so the UI remains explorable.
 */
import { API_BASE_URL } from '@env';

const BASE = (API_BASE_URL as string) || 'http://localhost:3001';

async function rpc<T>(path: string, input: unknown): Promise<T> {
  try {
    const res = await fetch(BASE + '/rpc/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: input ? JSON.stringify(input) : '{}',
    });
    const json = (await res.json()) as { ok: boolean; data?: T; error?: string };
    if (!json.ok) throw new Error(json.error ?? 'RPC error');
    return json.data as T;
  } catch (e) {
    // Offline mode: rethrow so callers can show a clear offline state.
    throw new Error('Backend unreachable: ' + (e as Error).message);
  }
}

export const api = {
  compile: (input: { name: string; fqbn: string; files: Array<{ path: string; content: string }> }) =>
    rpc<{ ok: boolean; diagnostics: any[]; firmwarePath?: string; durationMs: number; stdout: string }>('compile', input),
  diagnostics: { explain: (input: any) => rpc('diagnostics/explain', input) },
  boards: { list: (input: { query?: string }) => rpc('boards/list', input) },
  libraries: { list: (input: { query?: string }) => rpc('libraries/list', input) },
  sketches: {
    list: () => rpc('sketches/list', {}),
    get: (id: string) => rpc('sketches/get', { id }),
    create: (input: any) => rpc('sketches/create', input),
    save: (input: any) => rpc('sketches/save', input),
  },
  ai: {
    explainError: (input: any) => rpc('ai/explainError', input),
    generate: (input: { prompt: string; boardFqbn?: string }) => rpc('ai/generate', input),
    fix: (input: any) => rpc('ai/fix', input),
  },
  examples: {
    list: () => rpc('examples/list', {}),
    get: (id: string) => rpc('examples/get', { id }),
  },
};
