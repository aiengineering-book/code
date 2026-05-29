// #book-ref ch10-ingestion/server/src/database/client.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env.js';
import * as schema from './schema.js';

const sql = postgres(env.DATABASE_URL);
export const db = drizzle(sql, { schema });
