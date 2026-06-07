// #book-ref ch06-llm-api/server/src/database/client.ts

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env.js';

const sql = postgres(env.DATABASE_URL);
export const db = drizzle(sql);
