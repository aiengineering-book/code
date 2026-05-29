// #book-ref ch12-production-rag/server/src/services/bm25-service.ts
import { BM25Index } from '@tsaibook/bm25';
import { db } from '../database/client.js';

interface BM25Doc {
  id: string;
  content: string;
  tokens: string[];
}

/**
 * Chinese tokenization (simple version: split by character)
 * Production: consider nodejieba or a tokenization API
 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];

  const chineseWords = text.match(/[\u4e00-\u9fa5]+/g) ?? [];
  const englishWords = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

  // Chinese: split by bigrams (single chars + pairs)
  for (const word of chineseWords) {
    for (let i = 0; i < word.length; i++) {
      tokens.push(word[i]!);
      if (i < word.length - 1) tokens.push(word[i]! + word[i + 1]!);
    }
  }

  tokens.push(...englishWords);
  return tokens;
}

class BM25Service {
  private index: BM25Index | null = null;
  private docs: BM25Doc[] = [];
  private lastBuilt: Date | null = null;

  async build(): Promise<void> {
    const chunks = await db.query.documentChunks.findMany({
      columns: { id: true, content: true },
    });

    this.docs = chunks.map((c) => ({
      id: c.id,
      content: c.content,
      tokens: tokenize(c.content),
    }));

    this.index = new BM25Index();
    for (const doc of this.docs) {
      this.index.addTokens(doc.id, doc.tokens);
    }
    this.lastBuilt = new Date();
  }

  search(
    query: string,
    limit = 10,
  ): Array<{ id: string; content: string; score: number }> {
    if (!this.index) throw new Error('BM25 index not built');

    const results = this.index.searchTokens(tokenize(query)) as Array<{
      id: string;
      score: number;
    }>;

    return results.slice(0, limit).map((r) => ({
      id: r.id,
      content: this.docs.find((d) => d.id === r.id)?.content ?? '',
      score: r.score,
    }));
  }

  get needsRebuild(): boolean {
    if (!this.lastBuilt) return true;
    return Date.now() - this.lastBuilt.getTime() > 60 * 60 * 1000;
  }
}

export const bm25Service = new BM25Service();
