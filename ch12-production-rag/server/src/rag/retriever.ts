// Retrieval with source metadata (ch12 pitfall: cross-document answers interfering)

import { sql } from 'drizzle-orm';
import { db } from '../database/client.js';
import { embedText } from '../lib/embedding.js';

interface ChunkWithMeta {
  content: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  similarity: number;
}

export async function retrieveWithMeta(
  query: string,
  topK = 5,
): Promise<ChunkWithMeta[]> {
  const embedding = await embedText(query);

  const results = await db.execute(sql`
    SELECT
      dc.content,
      dc.chunk_index,
      d.id as document_id,
      d.filename as document_title,
      1 - (dc.embedding <=> ${JSON.stringify(embedding)}::vector) as similarity
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    ORDER BY similarity DESC
    LIMIT ${topK}
  `);

  return results as unknown as ChunkWithMeta[];
}

// System prompt instructs the LLM to cite sources explicitly and flag conflicts
export function buildRagPromptWithSources(chunks: ChunkWithMeta[]): string {
  const contextBlocks = chunks
    .map(
      (c, i) => `[Source ${i + 1}] Document "${c.documentTitle}"\n${c.content}`,
    )
    .join('\n\n---\n\n');

  return `You are a knowledge base Q&A assistant. Answer the question based on the following retrieval results.

Rules:
1. Always cite the source when answering (e.g., "Based on source 2")
2. If sources contradict each other, explicitly flag the conflict — do not choose one
3. If retrieved results are insufficient, say "No relevant information found in the knowledge base"

Retrieved results:
${contextBlocks}`;
}
