// #book-ref ch04-fullstack-basics/server/drizzle.config.ts

import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
  schema: './src/database/schema.ts', // Where the schema lives
  out: './src/database/migrations', // Where to write migration files
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
