import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL_KEY = '@droidvibe/api_url';
const AI_MODEL_KEY = '@droidvibe/ai_model';
const AI_KEY_KEY = '@droidvibe/ai_key';
const AI_PROVIDER_KEY = '@droidvibe/ai_provider';

export const DEFAULT_AI_MODEL = 'mistral-large-latest';
export const DEFAULT_AI_PROVIDER = 'mistral';

export async function getApiUrl(): Promise<string> {
  return (await AsyncStorage.getItem(API_URL_KEY)) ?? '';
}

export async function setApiUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(API_URL_KEY, url);
}

export async function getAiModel(): Promise<string> {
  return (await AsyncStorage.getItem(AI_MODEL_KEY)) ?? DEFAULT_AI_MODEL;
}

export async function setAiModel(model: string): Promise<void> {
  await AsyncStorage.setItem(AI_MODEL_KEY, model);
}

export async function getAiKey(): Promise<string> {
  return (await AsyncStorage.getItem(AI_KEY_KEY)) ?? '';
}

export async function setAiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(AI_KEY_KEY, key);
}

export async function getAiProvider(): Promise<string> {
  return (await AsyncStorage.getItem(AI_PROVIDER_KEY)) ?? DEFAULT_AI_PROVIDER;
}

export async function setAiProvider(provider: string): Promise<void> {
  await AsyncStorage.setItem(AI_PROVIDER_KEY, provider);
}