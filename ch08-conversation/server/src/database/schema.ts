// #book ch08-conversation-schema
import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
// ch08-conversation/server/src/database/schema.ts

// 会话表
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  title: text('title').notNull().default('新对话'),
  // 会话摘要（用于历史压缩）
  summary: text('summary'),
  // 已压缩的消息轮数
  compressedTurns: integer('compressed_turns').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 消息表
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  // 存储 Token 用量（用于成本追踪）
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
// #endbook
