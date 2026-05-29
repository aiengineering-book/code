import 'dotenv/config';
import OpenAI from 'openai';

export const openai = new OpenAI();
export const DEFAULT_MODEL = 'gpt-4o-mini';
