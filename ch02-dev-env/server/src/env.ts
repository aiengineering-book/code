// #book ch02-env-schema
import { z } from 'zod';
// ch02-dev-env/server/src/env.ts

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ 环境变量配置错误：');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
// #endbook
