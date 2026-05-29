import OpenAI from 'openai';
import { env } from '../env.js';

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  timeout: 5 * 60 * 1000,
  maxRetries: 0,
});

export const DEFAULT_MODEL = 'gpt-4o';
