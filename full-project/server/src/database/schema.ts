import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

// ─── Users & Auth (ch04) ──────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  tier: text('tier', { enum: ['free', 'pro', 'enterprise'] })
    .notNull()
    .default('free'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ─── RAG Documents & Knowledge Bases (ch09-ch12) ───────────────────────────────

export const documentStatusEnum = pgEnum('document_status', [
  'pending',
  'processing',
  'ready',
  'failed',
]);

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  status: documentStatusEnum('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  chunkCount: integer('chunk_count'),
  totalTokens: integer('total_tokens'),
  contentHash: text('content_hash'),
  version: integer('version').notNull().default(1),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export const documentChunks = pgTable(
  'document_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    embedding: vector('embedding', { dimensions: 1536 }),
    chunkIndex: integer('chunk_index').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    embeddingIdx: index('document_chunks_embedding_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
    documentIdIdx: index('document_chunks_document_id_idx').on(
      table.documentId,
    ),
  }),
);

export type DocumentChunk = typeof documentChunks.$inferSelect;

export const knowledgeBases = pgTable('knowledge_bases', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  ownerType: text('owner_type', { enum: ['user', 'organization'] }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  visibility: text('visibility', { enum: ['private', 'team', 'public'] })
    .notNull()
    .default('private'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const knowledgeBaseMembers = pgTable('knowledge_base_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  knowledgeBaseId: uuid('knowledge_base_id')
    .notNull()
    .references(() => knowledgeBases.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['viewer', 'editor', 'admin'] })
    .notNull()
    .default('viewer'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ─── Conversation Management (ch08) ─────────────────────────────────────────────

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('New conversation'),
  summary: text('summary'),
  compressedTurns: integer('compressed_turns').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

// ─── Production Monitoring (ch23) ──────────────────────────────────────────────

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
