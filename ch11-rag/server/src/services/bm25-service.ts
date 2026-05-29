// #book ch11-bm25-service
// ch11-rag/server/src/services/bm25-service.ts
import { BM25Index } from '@tsaibook/bm25';
import { db } from '../database/client.js';

interface BM25Doc {
  id: string;
  content: string;
  tokens: string[];
}

/**
 * Tokenizer (simple version: splits on word boundaries)
 * For production use of languages with no spaces (Chinese, Japanese),
 * consider nodejieba or a tokenization API
 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];

  // Extract word-like sequences
  const englishWords = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

  // For any non-ASCII sequences, use character bigrams
  const nonAscii = text.match(/[^\x00-\x7F]+/g) ?? [];
  for (const word of nonAscii) {
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
// #endbook
