import { DEFAULT_MODEL, openai } from './openai.js';

type Message = { role: 'user' | 'assistant' | 'system'; content: string };

export async function callLLM(
  messages: Message[],
  options: { temperature?: number } = {},
): Promise<{ text: string }> {
  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages,
    ...(options.temperature !== undefined
      ? { temperature: options.temperature }
      : {}),
  });
  const text = response.choices[0]?.message?.content ?? '';
  return { text };
}
