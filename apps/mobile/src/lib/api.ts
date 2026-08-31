/**
 * Typed RPC client for the DroidVibe backend. Calls POST /rpc/<ns>/<proc> with
 * a JSON body. Falls back to a clear offline error when the backend is
 * unreachable so the UI can show an explicit offline state (never fake success).
 */
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_BASE =
  ((Constants.expoConfig?.extra?.DROIDVIBE_API_URL as string | undefined) ||
    'http://localhost:3001');

const API_URL_KEY = '@droidvibe/api_url';

let apiBaseCache: string = DEFAULT_BASE;
let apiBaseReady = false;

/** Sync getter for the currently resolved backend base URL. */
export function getApiBase(): string {
  return apiBaseCache;
}

/** Re-read the user-configured backend URL from AsyncStorage and refresh the cache. */
export async function invalidateApiBaseCache(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(API_URL_KEY);
    apiBaseCache = stored && stored.trim() ? stored : DEFAULT_BASE;
  } catch {
    apiBaseCache = DEFAULT_BASE;
  }
  apiBaseReady = true;
}

async function ensureApiBase(): Promise<void> {
  if (!apiBaseReady) await invalidateApiBaseCache();
}

// Best-effort initial resolution on module load.
invalidateApiBaseCache().catch(() => { /* ignore */ });

async function rpc<T>(path: string, input: unknown): Promise<T> {
  await ensureApiBase();
  try {
    const res = await fetch(getApiBase() + '/rpc/' + path, {
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
    explainError: (input: unknown) => rpc('ai/explainError', input),
    generate: (input: { prompt: string; boardFqbn?: string }) => rpc('ai/generate', input),
    fix: (input: unknown) => rpc('ai/fix', input),
  },
  examples: {
    list: () => rpc('examples/list', {}),
    get: (id: string) => rpc('examples/get', { id }),
  },
};