import type { z } from 'zod';
import { DEFAULT_MODEL, openai } from './openai.js';

export async function structuredOutput<T extends z.ZodTypeAny>(
  schema: T,
  userMessage: string,
  systemMessage?: string,
): Promise<z.output<T>> {
  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      ...(systemMessage
        ? [{ role: 'system' as const, content: systemMessage }]
        : []),
      { role: 'user' as const, content: userMessage },
    ],
    response_format: { type: 'json_object' },
  });
  const content = response.choices[0]?.message?.content ?? '{}';
  return schema.parse(JSON.parse(content)) as z.output<T>;
}
