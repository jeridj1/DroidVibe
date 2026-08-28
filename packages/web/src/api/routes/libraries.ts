import { z } from 'zod';
import { procedure } from '../../rpc.js';
import { spawn } from 'node:child_process';
import { env } from '../../env.js';

export interface LibraryEntry {
  name: string;
  version?: string;
  author?: string;
  sentence?: string;
  paragraph?: string;
  installed?: boolean;
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

export const list = procedure(SearchInput, async ({ input }) => {
  const raw = await runCli(['lib', 'list', '--format', 'json', '--all']);
  let entries: LibraryEntry[] = [];
  try {
    const parsed = JSON.parse(raw || '[]');
    entries = Array.isArray(parsed) ? parsed : parsed.libraries ?? [];
  } catch {
    entries = [];
  }
  const q = input.query.toLowerCase();
  const filtered = entries.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      (e.author ?? '').toLowerCase().includes(q) ||
      (e.sentence ?? '').toLowerCase().includes(q),
  );
  return { libraries: filtered.slice(0, input.limit), total: filtered.length };
});

const InstallInput = z.object({ name: z.string() });
export const install = procedure(InstallInput, async ({ input }) => {
  await runCli(['lib', 'update-index']);
  const r = await runCli(['lib', 'install', input.name]);
  return { ok: !r.includes('Error'), message: r };
});
