import { DEFAULT_MODEL, openai } from './openai.js';

type Message = { role: 'user' | 'assistant' | 'system'; content: string };

export interface LLMCallOptions {
  model?: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function callLLM(
  messages: Message[],
  options: LLMCallOptions = {},
): Promise<{ text: string }> {
  const allMessages: Message[] = [];
  if (options.system) {
    allMessages.push({ role: 'system', content: options.system });
  }
  allMessages.push(...messages);

  const response = await openai.chat.completions.create({
    model: options.model ?? DEFAULT_MODEL,
    messages: allMessages,
    ...(options.temperature !== undefined
      ? { temperature: options.temperature }
      : {}),
    ...(options.maxTokens !== undefined
      ? { max_completion_tokens: options.maxTokens }
      : {}),
  });
  const text = response.choices[0]?.message?.content ?? '';
  return { text };
}
