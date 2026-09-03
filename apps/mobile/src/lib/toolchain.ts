export type LocalCompileResult = {
  ok: boolean;
  firmwareBase64: string;
  filename: string;
  output: string;
  exitCode: number;
};

type NativeToolchain = {
  status(): Promise<{ available: boolean; path: string; dataDir: string; userDir: string }>;
  compileSketch(input: { name: string; fqbn: string; code: string }): Promise<LocalCompileResult>;
  installCore(packageName: string): Promise<{ ok: boolean; output: string; exitCode: number }>;
  installLibrary(libraryName: string): Promise<{ ok: boolean; output: string; exitCode: number }>;
  searchLibraries(query: string): Promise<{ ok: boolean; output: string; exitCode: number }>;
  listBoards(): Promise<{ ok: boolean; output: string; exitCode: number }>;
  installedCores(): Promise<{ ok: boolean; output: string; exitCode: number }>;
  installedLibraries(): Promise<{ ok: boolean; output: string; exitCode: number }>;
};

function getNativeToolchain(): NativeToolchain | null {
  try {
    const proxy = (globalThis as any).nativeModulesProxy ?? (globalThis as any).NativeModules;
    const mod = proxy?.DroidVibeToolchain;
    return (mod as NativeToolchain) ?? null;
  } catch {
    return null;
  }
}

export function isLocalToolchainAvailable(): boolean {
  return getNativeToolchain() !== null;
}

export async function localToolchainStatus() {
  const mod = getNativeToolchain();
  if (!mod) return { available: false, path: '', dataDir: '', userDir: '' };
  return mod.status();
}

export async function compileSketchLocally(name: string, fqbn: string, code: string): Promise<LocalCompileResult> {
  const mod = getNativeToolchain();
  if (!mod) {
    return { ok: false, firmwareBase64: '', filename: '', output: 'Local Arduino toolchain is unavailable. Use a production/dev APK with the bundled Arduino CLI.', exitCode: -1 };
  }
  return mod.compileSketch({ name, fqbn, code });
}

export async function installBoardCore(packageName: string) {
  const mod = getNativeToolchain();
  if (!mod) return { ok: false, output: 'Local Arduino toolchain is unavailable.', exitCode: -1 };
  return mod.installCore(packageName);
}

export async function installArduinoLibrary(libraryName: string) {
  const mod = getNativeToolchain();
  if (!mod) return { ok: false, output: 'Local Arduino toolchain is unavailable.', exitCode: -1 };
  return mod.installLibrary(libraryName);
}

export async function searchArduinoLibraries(query: string) {
  const mod = getNativeToolchain();
  if (!mod) return { ok: false, output: 'Local Arduino toolchain is unavailable.', exitCode: -1 };
  return mod.searchLibraries(query);
}

export async function listLocalBoards() {
  const mod = getNativeToolchain();
  if (!mod) return { ok: false, output: 'Local Arduino toolchain is unavailable.', exitCode: -1 };
  return mod.listBoards();
}

export async function listInstalledCores() {
  const mod = getNativeToolchain();
  if (!mod) return { ok: false, output: 'Local Arduino toolchain is unavailable.', exitCode: -1 };
  return mod.installedCores();
}

export async function listInstalledLibraries() {
  const mod = getNativeToolchain();
  if (!mod) return { ok: false, output: 'Local Arduino toolchain is unavailable.', exitCode: -1 };
  return mod.installedLibraries();
}
