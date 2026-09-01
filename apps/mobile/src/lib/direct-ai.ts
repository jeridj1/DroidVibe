/**
 * Direct AI client — calls AI provider APIs directly from the phone.
 * No backend server required. User provides their own API key.
 *
 * Supports: Mistral, OpenAI, Google Gemini.
 */
import { getAiProvider, getAiKey, getAiModel } from './appConfig';

const SYSTEM_PROMPTS = {
  explainError: 'You are an Arduino expert. Explain compilation errors concisely and suggest fixes. The user is a beginner.',
  generate: 'You are an Arduino code generator. Generate clean, well-commented Arduino C/C++ code. Return only the code in a code block.',
  fix: 'You are an Arduino code fixer. Fix the compilation errors in the provided code. Return only the fixed code in a code block.',
};

async function callMistral(apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mistral API error (${res.status}): ${err}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

async function callOpenAI(apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

async function callGoogle(apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] },
      ],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google AI API error (${res.status}): ${err}`);
  }
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callAi(systemPrompt: string, userPrompt: string): Promise<string> {
  const provider = await getAiProvider();
  const apiKey = await getAiKey();
  const model = await getAiModel();
  if (!apiKey) throw new Error('No API key configured. Add one in Settings.');
  switch (provider) {
    case 'openai': return callOpenAI(apiKey, model, systemPrompt, userPrompt);
    case 'google': return callGoogle(apiKey, model, systemPrompt, userPrompt);
    default: return callMistral(apiKey, model, systemPrompt, userPrompt);
  }
}

function extractCode(text: string): string {
  const match = text.match(/```(?:cpp|c|arduino)?\n?([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

export const directAi = {
  isAvailable: async (): Promise<boolean> => {
    const key = await getAiKey();
    return !!key;
  },

  explainError: async (input: { error: string; code?: string; board?: string }): Promise<{ explanation: string }> => {
    const prompt = `Error: ${input.error}\n${input.code ? 'Code:\n' + input.code : ''}\n${input.board ? 'Board: ' + input.board : ''}\n\nExplain this error and how to fix it.`;
    const text = await callAi(SYSTEM_PROMPTS.explainError, prompt);
    return { explanation: text };
  },

  generate: async (input: { prompt: string; boardFqbn?: string }): Promise<{ code: string }> => {
    const prompt = `Generate Arduino code for: ${input.prompt}\n${input.boardFqbn ? 'Target board: ' + input.boardFqbn : ''}`;
    const text = await callAi(SYSTEM_PROMPTS.generate, prompt);
    return { code: extractCode(text) };
  },

  fix: async (input: { code: string; error: string }): Promise<{ code: string }> => {
    const prompt = `Fix this code that has compilation errors:\n\nError: ${input.error}\n\nCode:\n${input.code}`;
    const text = await callAi(SYSTEM_PROMPTS.fix, prompt);
    return { code: extractCode(text) };
  },
};