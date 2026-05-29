// #book ch09-vector-schema
import {
// ch09-embedding/server/src/database/schema.ts
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';

// 文档块表（RAG 的核心数据表）
export const documentChunks = pgTable(
  'document_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // 所属文档（下一章会建 documents 表）
    documentId: uuid('document_id').notNull(),
    // 文本内容
    content: text('content').notNull(),
    // 元数据（页码、标题等）
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    // 向量嵌入（1536 维，对应 text-embedding-3-small）
    embedding: vector('embedding', { dimensions: 1536 }),
    // 在文档中的位置（用于排序和上下文扩展）
    chunkIndex: integer('chunk_index').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // HNSW 索引：高召回率的近似最近邻搜索
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
