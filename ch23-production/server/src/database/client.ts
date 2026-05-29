// Stub: 完整实现见 ch04
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env.js';
import * as schema from './schema.js';

const sql = postgres(env.DATABASE_URL ?? 'postgres://localhost:5432/tsaibook');
export const db = drizzle(sql, { schema });
