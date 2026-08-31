/**
 * AsyncStorage-backed app configuration for DroidVibe.
 * Stores user-configured backend URL, Mistral AI model, and API key on-device.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  apiUrl: '@droidvibe/api_url',
  aiModel: '@droidvibe/ai_model',
  aiKey: '@droidvibe/ai_key',
} as const;

export const DEFAULT_AI_MODEL = 'mistral-large-latest';

export async function getApiUrl(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEYS.apiUrl);
  } catch {
    return null;
  }
}

export async function setApiUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.apiUrl, url);
}

export async function getAiModel(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEYS.aiModel);
  } catch {
    return null;
  }
}

export async function setAiModel(model: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.aiModel, model);
}

export async function getAiKey(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEYS.aiKey);
  } catch {
    return null;
  }
}

export async function setAiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.aiKey, key);
}
