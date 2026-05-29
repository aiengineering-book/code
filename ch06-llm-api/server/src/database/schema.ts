import {
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// #book ch06-usage-schema
// ch06 不依赖 ch04 的用户系统，userId 只是一个标识字符串
// ch06-llm-api/server/src/database/schema.ts
export const usageLogs = pgTable('usage_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  // numeric 而非 float：财务数据需要精确小数，float 有精度误差
  costUsd: numeric('cost_usd', { precision: 10, scale: 8 }).notNull(),
  endpoint: text('endpoint').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
// #endbook
