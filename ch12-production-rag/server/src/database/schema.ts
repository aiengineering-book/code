import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

// Document chunk table (core RAG data table)
export const documentChunks = pgTable(
  'document_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Parent document
    documentId: uuid('document_id').notNull(),
    // Text content
    content: text('content').notNull(),
    // Metadata (page number, title, etc.)
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    // Vector embedding (1536-dim, for text-embedding-3-small)
    embedding: vector('embedding', { dimensions: 1536 }),
    // Position within the document (for ordering and context expansion)
    chunkIndex: integer('chunk_index').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // HNSW index: high-recall approximate nearest-neighbor search
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

import { pgEnum } from 'drizzle-orm/pg-core';

export const documentStatusEnum = pgEnum('document_status', [
  'pending', // awaiting processing
  'processing', // being processed
  'ready', // processing complete, available for retrieval
  'failed', // processing failed
]);

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  // Original filename
  filename: text('filename').notNull(),
  // File type
  mimeType: text('mime_type').notNull(),
  // File size in bytes
  fileSize: integer('file_size').notNull(),
  // Processing status
  status: documentStatusEnum('status').notNull().default('pending'),
  // Error message (when processing fails)
  errorMessage: text('error_message'),
  // Chunk count (after processing completes)
  chunkCount: integer('chunk_count'),
  // Total token count (for cost tracking)
  totalTokens: integer('total_tokens'),
  // Document metadata (title, author, page count, etc.)
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  // Added in ch12: content hash (SHA-256) for detecting changes during incremental updates
  contentHash: text('content_hash'),
  // Added in ch12: document version number, incremented on each content change
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

// #book ch12-kb-schema
// ch12-production-rag/server/src/database/schema.ts
export const knowledgeBases = pgTable('knowledge_bases', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull(),
  ownerType: text('owner_type', { enum: ['user', 'organization'] }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  visibility: text('visibility', {
    enum: ['private', 'team', 'public'],
  })
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
  // In production, change to .references(() => users.id)
  userId: uuid('user_id').notNull(),
  role: text('role', { enum: ['viewer', 'editor', 'admin'] })
    .notNull()
    .default('viewer'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
// #endbook
