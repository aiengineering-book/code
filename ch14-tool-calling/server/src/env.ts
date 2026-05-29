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
  TAVILY_API_KEY: process.env.TAVILY_API_KEY ?? '',
  WEATHER_API_KEY: process.env.WEATHER_API_KEY ?? '',
};
