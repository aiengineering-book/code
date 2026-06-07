// #book-ref ch10-ingestion/server/src/database/schema.ts

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
  'pending', // Waiting to be processed
  'processing', // Currently processing
  'ready', // Processing complete, searchable
  'failed', // Processing failed
]);

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  // Original filename
  filename: text('filename').notNull(),
  // MIME type
  mimeType: text('mime_type').notNull(),
  // File size in bytes
  fileSize: integer('file_size').notNull(),
  // Processing status
  status: documentStatusEnum('status').notNull().default('pending'),
  // Error message (when processing fails)
  errorMessage: text('error_message'),
  // Chunk count (populated after processing completes)
  chunkCount: integer('chunk_count'),
  // Total token count (for cost tracking)
  totalTokens: integer('total_tokens'),
  // Document metadata (title, author, page count, etc.)
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
