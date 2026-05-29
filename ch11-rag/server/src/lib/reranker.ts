// #book ch11-reranker
import { CohereClient } from 'cohere-ai';
// ch11-rag/server/src/lib/reranker.ts
import { env } from '../env.js';
import { withRetry } from './retry.js';

const cohere = new CohereClient({ token: env.COHERE_API_KEY ?? '' });

export interface RerankResult<T extends { id: string; content: string }> {
  document: T;
  relevanceScore: number;
  rank: number;
}

export async function rerank<T extends { id: string; content: string }>(
  query: string,
  documents: T[],
  topN = documents.length,
): Promise<RerankResult<T>[]> {
  if (documents.length === 0) return [];

  const response = await withRetry(() =>
    cohere.rerank({
      model: 'rerank-multilingual-v3.0', // 多语种，含中文
      query,
      documents: documents.map((d) => d.content),
      topN,
      returnDocuments: false,
    }),
  );

  return response.results.map((r) => ({
    document: documents[r.index]!,
    relevanceScore: r.relevanceScore,
    rank: r.index,
  }));
}
// #endbook
