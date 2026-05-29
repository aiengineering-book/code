// #book ch04-drizzle-config
import { defineConfig } from 'drizzle-kit';
// ch04-fullstack-basics/server/drizzle.config.ts
import 'dotenv/config';

export default defineConfig({
  schema: './src/database/schema.ts', // Schema 定义在哪里
  out: './src/database/migrations', // 迁移文件生成到哪里
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
// #endbook
