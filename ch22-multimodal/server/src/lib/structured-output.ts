// #book-ref ch07-prompt-engineering/server/src/lib/structured-output.ts

import { z } from 'zod';
import { callLLM } from './llm.js';

/**
 * Call the LLM and validate the output against a Zod schema
 */
export async function structuredOutput<T>(
  schema: z.ZodType<T>,
  prompt: string,
  systemPrompt?: string,
  maxRetries = 2,
): Promise<T> {
  const schemaDescription = generateSchemaDescription(schema);

  const system = `
${systemPrompt ?? 'You are a data extraction assistant.'}

Important: your response must be valid JSON matching this structure:

${schemaDescription}

Output the JSON object directly — no explanation, no comments, no markdown code blocks.
`.trim();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { text } = await callLLM([{ role: 'user', content: prompt }], {
      system,
      temperature: 0,
    });

    // Strip possible markdown code block wrappers
    const cleaned = text
      .replace(/^```(?:json)?\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim();

    const parsed = safeJsonParse(cleaned);
    if (!parsed.success) {
      if (attempt === maxRetries) {
        throw new Error(`JSON parse failed: ${parsed.error}`);
      }
      continue;
    }

    const validated = schema.safeParse(parsed.data);
    if (!validated.success) {
      if (attempt === maxRetries) {
        throw new Error(
          `Schema validation failed: ${validated.error.flatten().fieldErrors}`,
        );
      }
      continue;
    }

    return validated.data;
  }

  throw new Error('Structured output failed');
}

// Convert a Zod schema to a human-readable description to help the model understand the expected format
function generateSchemaDescription(schema: z.ZodType): string {
  // Simplified: providing a JSON example is more effective than abstract description
  // Production: use the zod-to-json-schema library
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const example: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(shape)) {
      example[key] = getExampleValue(value as z.ZodType);
    }

    return JSON.stringify(example, null, 2);
  }

  return schema.description ?? 'valid JSON value';
}

function getExampleValue(schema: z.ZodType): unknown {
  if (schema instanceof z.ZodString) return 'string';
  if (schema instanceof z.ZodNumber) return 0;
  if (schema instanceof z.ZodBoolean) return true;
  if (schema instanceof z.ZodArray) return [];
  if (schema instanceof z.ZodEnum) return schema.options[0];
  if (schema instanceof z.ZodOptional) return getExampleValue(schema.unwrap());
  return null;
}

function safeJsonParse(
  text: string,
): { success: true; data: unknown } | { success: false; error: string } {
  try {
    return { success: true, data: JSON.parse(text) };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
