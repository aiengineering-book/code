import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
};
