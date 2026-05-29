// #book-ref ch12-production-rag/server/src/services/retrieval-service.ts
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

  // 多取候选，给重排序更多素材
  const candidates = await hybridSearch(query, {
    limit: useRerank ? limit * 3 : limit,
    minScore: 0,
    documentId,
  });

  if (candidates.length === 0) return [];

  // 有 Cohere Key 且候选数量足够时，执行重排序
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
      // 重排序失败，降级到混合检索结果
      console.warn('[retrieve] 重排序失败，降级：', error);
    }
  }

  return candidates.filter((c) => c.score >= minScore).slice(0, limit);
}
