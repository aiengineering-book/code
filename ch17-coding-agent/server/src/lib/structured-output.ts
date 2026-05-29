// Stub: 基于 ch13 的 structuredOutput，增加 feedback 重试版本

import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { DEFAULT_MODEL, openai } from './openai.js';

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
          systemMessage ?? '你是一个数据格式转换助手，精确转换不添加内容。',
          '',
          '必须严格按照以下 JSON Schema 输出：',
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
