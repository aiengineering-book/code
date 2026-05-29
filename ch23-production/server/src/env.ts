import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.string().default('development'),
  DATABASE_URL: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_HOST: z.string().url().optional(),
});

export const env = EnvSchema.parse(process.env);
