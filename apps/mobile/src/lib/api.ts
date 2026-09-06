/**
 * API client for DroidVibe.
 * - Compilation is done locally on-device (no backend needed).
 * - AI features work WITHOUT a backend when the user provides an API key.
 * - Backend is only used for cloud features (e.g., sketch sync).
 */
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { directAi } from './direct-ai';
import { compileSketch, isAvrGccInstalled, isArduinoCliInstalled, installAvrGcc, installArduinoCli } from './compiler';

const DEFAULT_BASE = ((Constants.expoConfig?.extra?.DROIDVIBE_API_URL as string | undefined) || '');

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

/**
 * Compile a sketch locally on-device using avr-gcc + arduino-cli.
 * Falls back to backend if local compilation fails (for debugging).
 */
export async function compileLocal(
  input: {
    name: string;
    fqbn: string;
    files: Array<{ path: string; content: string }>;
  },
  onProgress?: (progress: number, message: string) => void
): Promise<{
  ok: boolean;
  diagnostics: Array<{ file: string; line: number; column: number; message: string; severity: string }>;
  firmware?: string;
  firmwarePath?: string;
  durationMs: number;
  stdout: string;
}> {
  if (!input.files || input.files.length === 0) {
    return {
      ok: false,
      diagnostics: [{ 
        file: '', 
        line: 0, 
        column: 0, 
        message: 'No files provided for compilation', 
        severity: 'error' 
      }],
      firmware: undefined,
      firmwarePath: undefined,
      durationMs: 0,
      stdout: 'Validation failed: No files provided'
    };
  }

  try {
    if (!(await isAvrGccInstalled()) || !(await isArduinoCliInstalled())) {
      onProgress?.(0, 'Installing compiler tools...');
      const gccInstalled = await installAvrGcc(onProgress);
      const cliInstalled = await installArduinoCli(onProgress);
      if (!gccInstalled || !cliInstalled) {
        return {
          ok: false,
          diagnostics: [],
          firmware: undefined,
          firmwarePath: undefined,
          durationMs: 0,
          stdout: 'Failed to install compiler tools. Check your internet connection.',
        };
      }
    }

    const startTime = Date.now();
    const result = await compileSketch(input.files[0].content, input.fqbn, onProgress);
    const durationMs = Date.now() - startTime;

    if (result.success && result.hex) {
      return {
        ok: true,
        diagnostics: [],
        firmware: result.hex,
        firmwarePath: undefined,
        durationMs,
        stdout: 'Compilation successful.',
      };
    } else {
      return {
        ok: false,
        diagnostics: [{ file: input.files[0].path, line: 0, column: 0, message: result.error || 'Compilation failed', severity: 'error' }],
        firmware: undefined,
        firmwarePath: undefined,
        durationMs,
        stdout: result.error || 'Compilation failed.',
      };
    }
  } catch (e) {
    return {
      ok: false,
      diagnostics: [{ file: input.files[0].path, line: 0, column: 0, message: `Compilation error: ${e}`, severity: 'error' }],
      firmware: undefined,
      firmwarePath: undefined,
      durationMs: 0,
      stdout: `Compilation error: ${e}`,
    };
  }
}

async function rpc<T>(path: string, input: unknown): Promise<T> {
  try {
    const base = await ensureApiBase();
    if (!base) {
      throw new Error('No API base URL configured. Set DROIDVIBE_API_URL in app config or settings.');
    }
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
  compile: async (input: {
    name: string;
    fqbn: string;
    files: Array<{ path: string; content: string }>;
  }, onProgress?: (progress: number, message: string) => void) => {
    try {
      return await compileLocal(input, onProgress);
    } catch (e) {
      console.warn('Local compilation failed, falling back to backend:', e);
      try {
        return await rpc<{
          ok: boolean;
          diagnostics: unknown[];
          firmware?: string;
          firmwarePath?: string;
          durationMs: number;
          stdout: string;
        }>('compile', input);
      } catch (backendError) {
        return {
          ok: false,
          diagnostics: [{ file: input.files[0].path, line: 0, column: 0, message: `Compilation failed: ${backendError}`, severity: 'error' }],
          firmware: undefined,
          firmwarePath: undefined,
          durationMs: 0,
          stdout: `Compilation failed: ${backendError}`,
        };
      }
    }
  },
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
