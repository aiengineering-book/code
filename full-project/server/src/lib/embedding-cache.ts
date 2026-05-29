// #book-ref ch12-embedding-cache
// ch12-production-rag/server/src/lib/embedding-cache.ts
const cache = new Map<string, { embedding: number[]; ts: number }>();
const TTL = 10 * 60 * 1000; // 10 minutes
const MAX_SIZE = 1000;

export async function embedWithCache(text: string): Promise<number[]> {
  const key = text.trim().slice(0, 200);
  const hit = cache.get(key);

  if (hit && Date.now() - hit.ts < TTL) return hit.embedding;

  const { embedText } = await import('./embedding.js');
  const embedding = await embedText(text);
  cache.set(key, { embedding, ts: Date.now() });

  // LRU eviction
  if (cache.size > MAX_SIZE) {
    const oldest = [...cache.entries()]
      .sort(([, a], [, b]) => a.ts - b.ts)
      .slice(0, 200)
      .map(([k]) => k);
    oldest.forEach((k) => cache.delete(k));
  }

  return embedding;
}
