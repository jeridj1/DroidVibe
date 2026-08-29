/**
 * Offline sketch library — persists sketches locally via AsyncStorage so
 * users can browse, edit, and create without a backend connection.
 * Never fabricates cloud data; local sketches are clearly marked as local.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@droidvibe/local_sketches';

export interface LocalSketch {
  id: string;
  name: string;
  code: string;
  fqbn: string;
  createdAt: number;
  updatedAt: number;
}

function generateId(): string {
  return 'local_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
}

export async function getLocalSketches(): Promise<LocalSketch[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const sketches = JSON.parse(raw) as LocalSketch[];
    return sketches.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function saveLocalSketch(sketch: Omit<LocalSketch, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<LocalSketch> {
  const sketches = await getLocalSketches();
  const now = Date.now();
  let saved: LocalSketch;
  if (sketch.id && sketches.some(s => s.id === sketch.id)) {
    saved = { ...sketches.find(s => s.id === sketch.id)!, ...sketch, updatedAt: now };
    const updated = sketches.map(s => s.id === saved.id ? saved : s);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } else {
    saved = { ...sketch, id: sketch.id ?? generateId(), createdAt: now, updatedAt: now };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...sketches, saved]));
  }
  return saved;
}

export async function deleteLocalSketch(id: string): Promise<void> {
  const sketches = await getLocalSketches();
  const filtered = sketches.filter(s => s.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
