// #book-ref ch11-rag/server/src/env.ts

import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}

export const env = {
  OPENAI_API_KEY: required('OPENAI_API_KEY'),
  DATABASE_URL: required('DATABASE_URL'),
  PORT: Number(process.env.PORT ?? 3000),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  // Cohere Rerank API (optional; skips reranking if not set)
  COHERE_API_KEY: process.env.COHERE_API_KEY ?? '',
};
