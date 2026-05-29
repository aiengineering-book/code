// Stub: see ch06 for full schema
import { integer, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core';

export const usageLogs = pgTable('usage_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  model: text('model').notNull(),
  endpoint: text('endpoint').notNull().default('api'),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  cost: real('cost').notNull(),
  costUsd: real('cost_usd').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const experimentResults = pgTable('experiment_results', {
  id: text('id').primaryKey(),
  experimentId: text('experiment_id').notNull(),
  variantId: text('variant_id').notNull(),
  userId: text('user_id').notNull(),
  traceId: text('trace_id'),
  score: real('score'),
  latencyMs: integer('latency_ms'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  userRating: integer('user_rating'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
