import type { ZodType, z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { DEFAULT_MODEL, openai } from './openai.js';

export async function structuredOutput<T>(
  prompt: string,
  schema: ZodType<T>,
  systemMessage?: string,
): Promise<T> {
  const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' });

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system' as const,
        content: [
          systemMessage ?? 'You are a data format conversion assistant. Convert precisely without adding content.',
          '',
          'Output must strictly follow the JSON Schema below:',
          JSON.stringify(jsonSchema, null, 2),
        ].join('\n'),
      },
      { role: 'user' as const, content: prompt },
    ],
    response_format: { type: 'json_object' },
  });
  const content = response.choices[0]?.message?.content ?? '{}';
  return schema.parse(JSON.parse(content)) as T;
}

export async function structuredOutputWithFeedback<T extends z.ZodTypeAny>(
  schema: T,
  userMessage: string,
  systemMessage?: string,
): Promise<z.output<T>> {
  const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' });

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system' as const,
        content: [
          systemMessage ?? 'You are a data format conversion assistant. Convert precisely without adding content.',
          '',
          'Output must strictly follow the JSON Schema below:',
          JSON.stringify(jsonSchema, null, 2),
        ].join('\n'),
      },
      { role: 'user' as const, content: userMessage },
    ],
    response_format: { type: 'json_object' },
  });
  const content = response.choices[0]?.message?.content ?? '{}';
  return schema.parse(JSON.parse(content)) as z.output<T>;
}
