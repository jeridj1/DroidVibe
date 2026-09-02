/**
 * Typed RPC client for the DroidVibe backend. Calls POST /rpc/<ns>/<proc>.
 * Falls back to a local Termux backend when the configured remote service is
 * empty, unreachable, or times out.
 */
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { directAi } from './direct-ai';

const LOCAL_BASE = 'http://127.0.0.1:3001';
const DEFAULT_BASE =
  ((Constants.expoConfig?.extra?.DROIDVIBE_API_URL as string | undefined) || LOCAL_BASE).replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 5000;

let cachedBase: string | null = null;

export function getApiBase(): string {
  return cachedBase ?? DEFAULT_BASE;
}

async function ensureApiBase(): Promise<string> {
  if (cachedBase) return cachedBase;
  try {
    const stored = (await AsyncStorage.getItem('@droidvibe/api_url'))?.trim();
    cachedBase = (stored || DEFAULT_BASE || LOCAL_BASE).replace(/\/$/, '');
  } catch {
    cachedBase = DEFAULT_BASE || LOCAL_BASE;
  }
  return cachedBase;
}

export async function invalidateApiBaseCache(): Promise<void> {
  cachedBase = null;
}

async function postRpc<T>(base: string, path: string, input: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(base + '/rpc/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: input ? JSON.stringify(input) : '{}',
      signal: controller.signal,
    });
    const json = (await res.json()) as { ok: boolean; data?: T; error?: string };
    if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    return json.data as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function rpc<T>(path: string, input: unknown): Promise<T> {
  const configured = await ensureApiBase();
  const candidates = [configured, LOCAL_BASE].filter((base, index, all) => base && all.indexOf(base) === index);
  let lastError: unknown = null;

  for (const base of candidates) {
    try {
      const result = await postRpc<T>(base, path, input);
      cachedBase = base;
      return result;
    } catch (e) {
      lastError = e;
    }
  }

  throw new Error('Backend unreachable: ' + (lastError as Error)?.message);
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
    }>('compile', input),
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
