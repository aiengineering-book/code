// #book ch11-retrieval-service
// ch11-rag/server/src/services/retrieval-service.ts

import { env } from '../env.js';
import { rerank } from '../lib/reranker.js';
import { hybridSearch } from './hybrid-search.js';

export interface RetrievalResult {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
  rerankScore?: number;
}

export async function retrieve(
  query: string,
  options: {
    limit?: number | undefined;
    minScore?: number | undefined;
    documentId?: string | undefined;
    useRerank?: boolean | undefined;
  } = {},
): Promise<RetrievalResult[]> {
  const { limit = 5, minScore = 0.3, documentId, useRerank = true } = options;

  // Fetch more candidates to give the reranker material to work with
  const candidates = await hybridSearch(query, {
    limit: useRerank ? limit * 3 : limit,
    minScore: 0,
    documentId,
  });

  if (candidates.length === 0) return [];

  // Rerank if configured and there are enough candidates
  if (useRerank && env.COHERE_API_KEY && candidates.length > limit) {
    try {
      const reranked = await rerank(query, candidates, limit);
      return reranked
        .filter((r) => r.relevanceScore >= minScore)
        .map((r) => ({
          ...r.document,
          rerankScore: r.relevanceScore,
        }));
    } catch (error) {
      // Reranking failed — degrade to hybrid search results
      console.warn('[retrieve] Reranking failed, degrading:', error);
    }
  }

  return candidates.filter((c) => c.score >= minScore).slice(0, limit);
}
// #endbook
