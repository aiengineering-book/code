// #book-ref ch12-production-rag/server/src/lib/rrf.ts
export interface RankedResult {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  documentId?: string;
  score?: number;
}

/**
 * RRF formula: score(d) = Σ 1/(k + rank(d)), k is typically 60
 */
export function reciprocalRankFusion(
  rankings: RankedResult[][],
  k = 60,
  limit = 10,
): Array<RankedResult & { rrfScore: number }> {
  const scores = new Map<string, number>();
  const docMap = new Map<string, RankedResult>();

  for (const ranking of rankings) {
    ranking.forEach((doc, index) => {
      const rank = index + 1;
      scores.set(doc.id, (scores.get(doc.id) ?? 0) + 1 / (k + rank));
      docMap.set(doc.id, doc);
    });
  }

  return Array.from(scores.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([id, rrfScore]) => ({ ...docMap.get(id)!, rrfScore }));
}
