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

// 文档块表（RAG 的核心数据表）
export const documentChunks = pgTable(
  'document_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // 所属文档
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

// #book ch10-document-schema
import { pgEnum } from 'drizzle-orm/pg-core';
// ch10-ingestion/server/src/database/schema.ts

export const documentStatusEnum = pgEnum('document_status', [
  'pending', // 等待处理
  'processing', // 处理中
  'ready', // 处理完成，可以检索
  'failed', // 处理失败
]);

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  // 原始文件名
  filename: text('filename').notNull(),
  // 文件类型
  mimeType: text('mime_type').notNull(),
  // 文件大小（字节）
  fileSize: integer('file_size').notNull(),
  // 处理状态
  status: documentStatusEnum('status').notNull().default('pending'),
  // 错误信息（处理失败时）
  errorMessage: text('error_message'),
  // 分块数量（处理完成后）
  chunkCount: integer('chunk_count'),
  // 总 Token 数（用于成本追踪）
  totalTokens: integer('total_tokens'),
  // 文档元数据（标题、作者、页数等）
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
// #endbook
