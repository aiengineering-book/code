// #book ch09-vector-schema
// ch09-embedding/server/src/database/schema.ts
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

// Document chunks table (the core data table for RAG)
export const documentChunks = pgTable(
  'document_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Parent document (Chapter 10 adds the documents table)
    documentId: uuid('document_id').notNull(),
    // Text content
    content: text('content').notNull(),
    // Metadata (page number, section title, etc.)
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    // Vector embedding (1,536 dimensions for text-embedding-3-small)
    embedding: vector('embedding', { dimensions: 1536 }),
    // Position in the document (for ordering and context expansion)
    chunkIndex: integer('chunk_index').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // HNSW index: high-recall approximate nearest neighbor search
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
// #endbook
