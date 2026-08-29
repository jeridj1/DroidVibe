/**
 * Cloud sketch sync utility. Wraps local + cloud persistence so the
 * editor can save sketches both offline and to the backend when connected.
 * Never silently swallows errors — cloud failures are surfaced to the caller.
 */
import { api } from './api';
import { saveLocalSketch, getLocalSketches, type LocalSketch } from './offlineSketches';

export interface SyncResult {
  local: LocalSketch;
  cloudSynced: boolean;
  cloudError?: string;
}

/**
 * Save a sketch locally and attempt cloud sync.
 * Returns the local sketch + whether cloud sync succeeded.
 */
export async function syncSketch(
  name: string,
  code: string,
  fqbn: string,
  existingId?: string,
): Promise<SyncResult> {
  // Always save locally first (offline-first)
  const local = await saveLocalSketch({
    id: existingId,
    name,
    code,
    fqbn,
  });

  // Attempt cloud sync (best-effort, surface errors)
  try {
    if (existingId) {
      await api.sketches.save({
        id: existingId,
        name,
        code,
        fqbn,
      });
    } else {
      await api.sketches.create({
        name,
        code,
        fqbn,
      });
    }
    return { local, cloudSynced: true };
  } catch (e) {
    return {
      local,
      cloudSynced: false,
      cloudError: e instanceof Error ? e.message : 'Cloud sync failed',
    };
  }
}

/**
 * Check if the backend is reachable.
 */
export async function isCloudAvailable(): Promise<boolean> {
  try {
    await api.sketches.list();
    return true;
  } catch {
    return false;
  }
}