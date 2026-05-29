// #book ch09-embedding
import { openai } from './openai.js';
// ch09-embedding/server/src/lib/embedding.ts
import { withRetry } from './retry.js';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
// 批量嵌入的最大文本数（OpenAI 限制 2048 条/次）
const BATCH_SIZE = 100;

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  tokens: number;
}

/**
 * 对单个文本生成嵌入向量
 */
export async function embedText(text: string): Promise<number[]> {
  const result = await withRetry(() =>
    openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.trim(),
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  );

  return result.data[0]?.embedding;
}

/**
 * 批量生成嵌入向量（自动分批，避免超出 API 限制）
 */
export async function embedBatch(
  texts: string[],
  onProgress?: (completed: number, total: number) => void,
): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await withRetry(() =>
      openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch.map((t) => t.trim()),
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    );

    for (let j = 0; j < batch.length; j++) {
      results.push({
        text: batch[j]!,
        embedding: response.data[j]?.embedding,
        tokens: response.usage.total_tokens / batch.length, // 平均 Token 数（估算）
      });
    }

    onProgress?.(Math.min(i + BATCH_SIZE, texts.length), texts.length);

    // 批次之间稍作停顿，避免触发限流
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}
// #endbook
