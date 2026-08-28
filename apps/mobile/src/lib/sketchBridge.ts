/**
 * Simple module-level bridge for passing sketch code between tabs.
 * When an example is tapped on the Sketches tab, the code is stored here
 * and the Editor tab reads it on mount.
 */
let pendingCode: string | null = null;
let pendingName: string | null = null;

export function setPendingSketch(code: string, name?: string): void {
  pendingCode = code;
  pendingName = name ?? null;
}

export function consumePendingSketch(): { code: string; name: string } | null {
  if (pendingCode === null) return null;
  const result = { code: pendingCode, name: pendingName ?? 'Sketch' };
  pendingCode = null;
  pendingName = null;
  return result;
}
