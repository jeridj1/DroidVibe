/**
 * arduino-cli wrapper.
 *
 * Spawns the real arduino-cli binary as a subprocess in a per-job workspace.
 * Output is captured and parsed. The binary path, data dir and user dir are
 * configurable via env. This runs on the cloud backend, never on the phone.
 */
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../env.js';

export interface CliRunResult {
  code: number;
  stdout: string;
  stderr: string;
  /** Combined for parsing. */
  output: string;
}

function runCli(args: string[], opts: { cwd?: string; env?: Record<string, string> } = {}): Promise<CliRunResult> {
  return new Promise((resolve) => {
    const proc = spawn(env.arduinoCliPath, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr, output: stdout + stderr }));
    proc.on('error', (err) => resolve({ code: -1, stdout, stderr: String(err), output: stderr + String(err) }));
  });
}

/** Core/board management: ensure a board core is installed for an FQBN. */
export async function ensureCoreInstalled(fqbn: string): Promise<void> {
  // fqbn like "arduino:avr:uno" -> core id "arduino:avr"
  const parts = fqbn.split(':');
  if (parts.length < 2) return;
  const core = parts.slice(0, 2).join(':');
  const installed = await runCli(['core', 'list', '--format', 'json']);
  try {
    const list = JSON.parse(installed.output || '[]') as Array<{ id: string; installed?: boolean }>;
    const found = list.find((c) => c.id === core);
    if (found && found.installed !== false) return;
  } catch {
    // fall through to install
  }
  await runCli(['core', 'update-index']);
  await runCli(['core', 'install', core]);
}

/** Create a fresh per-job sketch directory and write the files into it. */
export async function prepareSketchJob(
  files: Array<{ path: string; content: string }>,
  name: string,
): Promise<{ jobDir: string; sketchDir: string; inoPath: string }> {
  const jobDir = join(env.jobDir, randomUUID());
  const sketchDir = join(jobDir, name.replace(/[^A-Za-z0-9_]/g, '_'));
  await mkdir(sketchDir, { recursive: true });
  let inoPath = '';
  for (const f of files) {
    const dest = join(sketchDir, f.path);
    await mkdir(join(dest, '..'), { recursive: true });
    await writeFile(dest, f.content, 'utf8');
    if (f.path.endsWith('.ino')) inoPath = dest;
  }
  if (!inoPath) {
    inoPath = join(sketchDir, name.replace(/[^A-Za-z0-9_]/g, '_') + '.ino');
    await writeFile(inoPath, '', 'utf8');
  }
  return { jobDir, sketchDir, inoPath };
}

/** Compile a sketch, returning the parsed result + firmware path on success. */
export async function compileSketch(
  inoPath: string,
  fqbn: string,
): Promise<{
  ok: boolean;
  stdout: string;
  firmwarePath: string | null;
  durationMs: number;
}> {
  await ensureCoreInstalled(fqbn);
  const buildDir = join(inoPath, '..', 'build');
  await mkdir(buildDir, { recursive: true });
  const start = Date.now();
  const r = await runCli([
    'compile',
    '--fqbn', fqbn,
    '--build-path', buildDir,
    '--format', 'json',
    inoPath,
  ], { env: { ARDUINO_DATA_DIR: env.arduinoDataDir, ARDUINO_USER_DIR: env.arduinoUserDir } });
  const durationMs = Date.now() - start;
  const ok = r.code === 0;
  let firmwarePath: string | null = null;
  if (ok) {
    // arduino-cli writes <name>.hex (avr) or <name>.bin in the build path.
    try {
      const parsed = JSON.parse(r.stdout || '{}');
      firmwarePath = parsed.build_path ? join(parsed.build_path, 'firmware.hex') : null;
    } catch {
      firmwarePath = join(buildDir, 'firmware.hex');
    }
  }
  return { ok, stdout: r.output, firmwarePath, durationMs };
}

/** Remove a job directory once it is no longer needed. */
export async function cleanupJob(jobDir: string): Promise<void> {
  await rm(jobDir, { recursive: true, force: true });
}
