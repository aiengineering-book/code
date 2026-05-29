// #book-ref ch12-production-rag/server/src/lib/similarity.ts
/**
 * Compute the cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Find the topK most similar candidates to the query vector
 */
export function findTopK<T extends { embedding: number[] }>(
  query: number[],
  candidates: T[],
  topK: number,
): Array<T & { score: number }> {
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: cosineSimilarity(query, candidate.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
