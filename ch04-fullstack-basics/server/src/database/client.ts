// #book ch04-drizzle-client
import { drizzle } from 'drizzle-orm/postgres-js';
// ch04-fullstack-basics/server/src/database/client.ts
import postgres from 'postgres';
import { env } from '../env.js';
import * as schema from './schema.js';

const queryClient = postgres(env.DATABASE_URL);
export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
// #endbook
