// 带来源元信息的检索（12.7 坑二：跨文档检索时答案互相干扰）

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

// System prompt 要求 LLM 明确引用来源，矛盾时如实告知
export function buildRagPromptWithSources(chunks: ChunkWithMeta[]): string {
  const contextBlocks = chunks
    .map((c, i) => `[来源 ${i + 1}] 文档《${c.documentTitle}》\n${c.content}`)
    .join('\n\n---\n\n');

  return `你是一个知识库问答助手。请根据以下检索结果回答问题。

规则：
1. 回答时必须注明来自哪个来源（如"根据来源 2"）
2. 如果不同来源之间有矛盾，明确指出矛盾，不要自行选择一个
3. 如果检索结果不足以回答问题，直接说"当前知识库中没有相关信息"

检索结果：
${contextBlocks}`;
}
