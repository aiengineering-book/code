// #book ch09-vector-service

// ch09-embedding/server/src/services/vector-service.ts
import { and, cosineDistance, desc, eq, sql } from 'drizzle-orm';
import { db } from '../database/client.js';
import type { DocumentChunk } from '../database/schema.js';
import { documentChunks } from '../database/schema.js';
import { embedText } from '../lib/embedding.js';

export interface SearchResult {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown>;
  chunkIndex: number;
  score: number; // 相似度分数（0-1，越高越相似）
}

/**
 * 向量相似度搜索
 */
export async function vectorSearch(
  query: string,
  options: {
    limit?: number;
    minScore?: number; // 最低相似度阈值
    documentId?: string; // 限定在某个文档内搜索
  } = {},
): Promise<SearchResult[]> {
  const { limit = 10, minScore = 0.5, documentId } = options;

  // 1. 将查询文本转换为向量
  const queryEmbedding = await embedText(query);

  // 2. 向量相似度查询
  // cosineDistance 返回距离（0=相同，2=相反），需要转换为相似度
  const similarity = sql<number>`1 - (${cosineDistance(documentChunks.embedding, queryEmbedding)})`;

  const results = await db
    .select({
      id: documentChunks.id,
      documentId: documentChunks.documentId,
      content: documentChunks.content,
      metadata: documentChunks.metadata,
      chunkIndex: documentChunks.chunkIndex,
      score: similarity,
    })
    .from(documentChunks)
    .where(
      and(
        // 过滤低相似度结果
        sql`1 - (${cosineDistance(documentChunks.embedding, queryEmbedding)}) > ${minScore}`,
        // 可选：限定文档范围
        documentId ? eq(documentChunks.documentId, documentId) : undefined,
      ),
    )
    .orderBy(desc(similarity))
    .limit(limit);

  return results as SearchResult[];
}

/**
 * 存储文本块及其向量
 */
export async function storeChunk(chunk: {
  documentId: string;
  content: string;
  metadata?: Record<string, unknown>;
  chunkIndex: number;
  embedding: number[];
}): Promise<DocumentChunk> {
  const [stored] = await db
    .insert(documentChunks)
    .values({
      documentId: chunk.documentId,
      content: chunk.content,
      metadata: chunk.metadata ?? {},
      chunkIndex: chunk.chunkIndex,
      embedding: chunk.embedding,
    })
    .returning();

  return stored!;
}

/**
 * 批量存储文本块。
 *
 * 分批插入，每批一个事务——单批内要么整批成功、要么整批回滚，
 * 上一批已经成功的不受下一批失败的影响。这是批处理里常见的折中：
 * 全量一个事务会把一次超大写入锁住整张表（几万条 × 6KB 向量很快就几百 MB），
 * 完全不用事务则每条都要各自 commit，吞吐差而且中途失败时只有一半记录写进去。
 */
export async function storeChunks(
  chunks: Array<{
    documentId: string;
    content: string;
    metadata?: Record<string, unknown>;
    chunkIndex: number;
    embedding: number[];
  }>,
): Promise<void> {
  if (chunks.length === 0) return;

  const BATCH = 500;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH).map((c) => ({
      documentId: c.documentId,
      content: c.content,
      metadata: c.metadata ?? {},
      chunkIndex: c.chunkIndex,
      embedding: c.embedding,
    }));

    // 每批独立事务：批内任何一条失败，整批回滚
    await db.transaction(async (tx) => {
      await tx.insert(documentChunks).values(slice);
    });
  }
}
// #endbook
