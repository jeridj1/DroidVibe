/**
 * Typed RPC client for the DroidVibe backend. Calls POST /rpc/<ns>/<proc>.
 * Falls back to a clear offline error when the backend is unreachable.
 *
 * AI features (explainError, generate, fix) work WITHOUT a backend when
 * the user provides an API key in Settings — calls go directly to the AI
 * provider from the phone via direct-ai.ts.
 */
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { directAi } from './direct-ai';

const DEFAULT_BASE =
  ((Constants.expoConfig?.extra?.DROIDVIBE_API_URL as string | undefined) ||
    'http://localhost:3001');

let cachedBase: string | null = null;

export function getApiBase(): string {
  return cachedBase ?? DEFAULT_BASE;
}

async function ensureApiBase(): Promise<string> {
  if (cachedBase) return cachedBase;
  try {
    const stored = await AsyncStorage.getItem('@droidvibe/api_url');
    cachedBase = stored || DEFAULT_BASE;
  } catch {
    cachedBase = DEFAULT_BASE;
  }
  return cachedBase;
}

export async function invalidateApiBaseCache(): Promise<void> {
  cachedBase = null;
}

async function rpc<T>(path: string, input: unknown): Promise<T> {
  try {
    const base = await ensureApiBase();
    const res = await fetch(base + '/rpc/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: input ? JSON.stringify(input) : '{}',
    });
    const json = (await res.json()) as { ok: boolean; data?: T; error?: string };
    if (!json.ok) throw new Error(json.error ?? 'RPC error');
    return json.data as T;
  } catch (e) {
    throw new Error('Backend unreachable: ' + (e as Error).message);
  }
}

export const api = {
  compile: (input: {
    name: string;
    fqbn: string;
    files: Array<{ path: string; content: string }>;
  }) =>
    rpc<{
      ok: boolean;
      diagnostics: unknown[];
      firmware?: string;
      firmwarePath?: string;
      durationMs: number;
      stdout: string;
    }>('compile', inpu
t),
  diagnostics: { explain: (input: unknown) => rpc('diagnostics/explain', input) },
  boards: { list: (input: { query?: string }) => rpc('boards/list', input) },
  libraries: { list: (input: { query?: string }) => rpc('libraries/list', input) },
  sketches: {
    list: () => rpc('sketches/list', {}),
    get: (id: string) => rpc('sketches/get', { id }),
    create: (input: unknown) => rpc('sketches/create', input),
    save: (input: unknown) => rpc('sketches/save', input),
  },
  ai: {
    explainError: async (input: unknown) => {
      if (await directAi.isAvailable()) return directAi.explainError(input as { error: string; code?: string; board?: string });
      return rpc('ai/explainError', input);
    },
    generate: async (input: { prompt: string; boardFqbn?: string }) => {
      if (await directAi.isAvailable()) return directAi.generate(input);
      return rpc('ai/generate', input);
    },
    fix: async (input: unknown) => {
      if (await directAi.isAvailable()) return directAi.fix(input as { code: string; error: string });
      return rpc('ai/fix', input);
    },
  },
  examples: {
    list: () => rpc('examples/list', {}),
    get: (id: string) => rpc('examples/get', { id }),
  },
};