import {
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// #book ch06-usage-schema
// ch06-llm-api/server/src/database/schema.ts
// ch06 doesn't depend on ch04's user system — userId is just an identifier string here
export const usageLogs = pgTable('usage_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  // numeric not float: financial data requires exact decimal representation
  costUsd: numeric('cost_usd', { precision: 10, scale: 8 }).notNull(),
  endpoint: text('endpoint').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
// #endbook
