import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const env = {
  OPENAI_API_KEY: required('OPENAI_API_KEY'),
  PORT: Number(process.env.PORT ?? 3000),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
};
