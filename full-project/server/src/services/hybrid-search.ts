// #book-ref ch12-production-rag/server/src/services/hybrid-search.ts
// #book-ref ch11-rag/server/src/services/hybrid-search.ts
import { reciprocalRankFusion } from '../lib/rrf.js';
import { bm25Service } from './bm25-service.js';
import { vectorSearch } from './vector-service.js';

export interface HybridSearchResult {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
}

export async function hybridSearch(
  query: string,
  options: {
    limit?: number | undefined;
    minScore?: number | undefined;
    documentId?: string | undefined;
  } = {},
): Promise<HybridSearchResult[]> {
  const { limit = 10, minScore = 0.0, documentId } = options;

  // Run both paths in parallel with extra candidates for RRF
  const [vectorResults, bm25Results] = await Promise.all([
    vectorSearch(query, { limit: limit * 2, minScore: 0, documentId }),
    Promise.resolve(
      bm25Service.needsRebuild
        ? bm25Service.build().then(() => bm25Service.search(query, limit * 2))
        : bm25Service.search(query, limit * 2),
    ),
  ]);

  // RRF fusion
  const fused = reciprocalRankFusion(
    [
      vectorResults.map((r) => ({
        id: r.id,
        content: r.content,
        metadata: r.metadata,
        documentId: r.documentId,
        score: r.score,
      })),
      bm25Results.map((r) => ({
        id: r.id,
        content: r.content,
        metadata: {},
        documentId: '',
        score: r.score,
      })),
    ],
    60,
    limit * 2,
  );

  // Normalize scores and fill in vector metadata
  const maxScore = fused[0]?.rrfScore ?? 1;

  return fused
    .map((r) => {
      const vr = vectorResults.find((v) => v.id === r.id);
      return {
        id: r.id,
        documentId: vr?.documentId ?? '',
        content: r.content,
        metadata: vr?.metadata ?? {},
        score: maxScore > 0 ? r.rrfScore / maxScore : 0,
      };
    })
    .filter((r) => r.score >= minScore && r.documentId)
    .slice(0, limit);
}
