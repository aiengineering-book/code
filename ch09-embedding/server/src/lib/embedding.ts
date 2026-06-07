// #book ch09-embedding
// ch09-embedding/server/src/lib/embedding.ts
import { openai } from './openai.js';
import { withRetry } from './retry.js';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
// Max texts per batch (OpenAI limit: 2048 per request)
const BATCH_SIZE = 100;

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  tokens: number;
}

/**
 * Generate an embedding vector for a single text
 */
export async function embedText(text: string): Promise<number[]> {
  const result = await withRetry(() =>
    openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.trim(),
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  );

  const embedding = result.data[0]?.embedding;
  if (!embedding) throw new Error('Embedding API returned no data');
  return embedding;
}

/**
 * Generate embedding vectors for a batch of texts (auto-splits to stay within API limits)
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
        embedding: response.data[j]!.embedding,
        tokens: response.usage.total_tokens / batch.length, // Average tokens (estimate)
      });
    }

    onProgress?.(Math.min(i + BATCH_SIZE, texts.length), texts.length);

    // Brief pause between batches to avoid rate limits
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}
// #endbook
