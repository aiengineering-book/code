// #book ch06-openai-client
// ch06-llm-api/server/src/lib/openai.ts
import OpenAI from 'openai';
import { env } from '../env.js';

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  timeout: 5 * 60 * 1000, // 5 minutes — long responses + streaming can genuinely take this long
  maxRetries: 0, // Disable built-in SDK retries
});

export const DEFAULT_MODEL = 'gpt-4o';
// #endbook
