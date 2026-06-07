// #book-ref ch09-embedding/server/src/services/vector-service.ts

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
  score: number; // Similarity score (0–1, higher = more similar)
}

/**
 * Vector similarity search
 */
export async function vectorSearch(
  query: string,
  options: {
    limit?: number;
    minScore?: number; // Minimum similarity threshold
    documentId?: string; // Restrict search to a specific document
  } = {},
): Promise<SearchResult[]> {
  const { limit = 10, minScore = 0.5, documentId } = options;

  // 1. Convert the query text to a vector
  const queryEmbedding = await embedText(query);

  // 2. Vector similarity query
  // cosineDistance returns distance (0 = same, 2 = opposite) — convert to similarity
  // Define once and reuse in SELECT, WHERE, and ORDER BY to avoid repeated computation
  const distance = cosineDistance(documentChunks.embedding, queryEmbedding);
  const similarity = sql<number>`1 - (${distance})`;

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
        sql`${similarity} > ${minScore}`,
        documentId ? eq(documentChunks.documentId, documentId) : undefined,
      ),
    )
    .orderBy(desc(similarity))
    .limit(limit);

  return results as SearchResult[];
}

/**
 * Store a single text chunk with its embedding
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
 * Bulk-store text chunks.
 *
 * Processed in batches with one transaction per batch — within a batch,
 * either everything succeeds or everything rolls back, and a previous
 * batch's success is unaffected by a later batch's failure.
 *
 * This is the standard batch-processing tradeoff:
 * - One giant transaction for all chunks locks the entire table for the duration
 *   (tens of thousands of chunks × 6KB each = hundreds of MB in one transaction)
 * - No transactions at all means each row commits separately — lower throughput
 *   and a half-written state on failure
 * - Per-batch transactions balance both concerns
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

    // Each batch runs in its own transaction: any failure within a batch rolls back the whole batch
    await db.transaction(async (tx) => {
      await tx.insert(documentChunks).values(slice);
    });
  }
}
