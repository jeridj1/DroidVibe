import { z } from 'zod';
import { procedure } from '../../rpc.js';
import { spawn } from 'node:child_process';
import { env } from '../../env.js';

export interface BoardsIndexEntry {
  name: string;
  architecture: string;
  version: string;
  id: string;
  boards?: Array<{ name: string; id: string }>;
  help?: unknown;
}

function runCli(args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn(env.arduinoCliPath, args, { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.stderr.on('data', (d) => (out += d.toString()));
    proc.on('close', () => resolve(out));
    proc.on('error', () => resolve(''));
  });
}

const SearchInput = z.object({ query: z.string().default(''), limit: z.number().default(50) });

/** List/search real board cores from arduino-cli core list. */
export const list = procedure(SearchInput, async ({ input }) => {
  const raw = await runCli(['core', 'list', '--format', 'json']);
  let entries: BoardsIndexEntry[] = [];
  try {
    const parsed = JSON.parse(raw || '[]');
    entries = Array.isArray(parsed) ? parsed : parsed.packages ?? [];
  } catch {
    entries = [];
  }
  const q = input.query.toLowerCase();
  const filtered = entries.filter((e) => e.id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q));
  return { boards: filtered.slice(0, input.limit), total: filtered.length, source: 'arduino-cli' };
});

const InstallInput = z.object({ core: z.string() });
export const install = procedure(InstallInput, async ({ input }) => {
  await runCli(['core', 'update-index']);
  const r = await runCli(['core', 'install', input.core]);
  return { ok: !r.includes('Error'), message: r };
});
