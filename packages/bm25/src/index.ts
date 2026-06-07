import { tokenize as defaultTokenize, type Tokenizer } from './tokenizer.js';

/**
 * BM25Index — Okapi BM25 full-text search
 *
 * Default parameter values follow academic convention:
 *   k1 = 1.5  term frequency saturation factor: larger = more boost for frequent terms
 *   b  = 0.75 document length normalization: 1.0 = full length penalty, 0 = ignore length
 *
 * Reference: Robertson & Zaragoza (2009), "The Probabilistic Relevance Framework: BM25 and Beyond"
 */

interface DocEntry {
  id: string;
  /** term → number of occurrences in this document (TF) */
  tf: Map<string, number>;
  /** total token count of this document (document length) */
  length: number;
}

export interface SearchResult {
  id: string;
  score: number;
}

export interface BM25Options {
  /** term frequency saturation factor, default 1.5 */
  k1?: number;
  /** document length normalization factor, default 0.75 */
  b?: number;
  /** custom tokenizer; defaults to built-in mixed Chinese/English tokenizer */
  tokenizer?: Tokenizer;
}

export class BM25Index {
  private docs: DocEntry[] = [];
  /** term → number of documents containing this term (DF) */
  private df: Map<string, number> = new Map();
  private avgdl = 0;

  private readonly k1: number;
  private readonly b: number;
  private readonly tokenize: Tokenizer;

  constructor(options: BM25Options = {}) {
    this.k1 = options.k1 ?? 1.5;
    this.b = options.b ?? 0.75;
    this.tokenize = options.tokenizer ?? defaultTokenize;
  }

  /**
   * Add a document
   * @param id    unique document identifier (returned in search results)
   * @param text  raw text, processed by the internal tokenizer
   */
  add(id: string, text: string): void {
    this.addTokens(id, this.tokenize(text));
  }

  /**
   * Add a pre-tokenized document (skips internal tokenization; suitable for batch preprocessing)
   */
  addTokens(id: string, tokens: string[]): void {
    const tf = new Map<string, number>();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) ?? 0) + 1);
    }

    this.docs.push({ id, tf, length: tokens.length });

    // Update DF
    for (const term of tf.keys()) {
      this.df.set(term, (this.df.get(term) ?? 0) + 1);
    }

    // Incrementally maintain average document length (avoids full recomputation each time)
    this.avgdl =
      (this.avgdl * (this.docs.length - 1) + tokens.length) / this.docs.length;
  }

  /**
   * Search
   * @param query raw query text
   * @param limit maximum number of results to return, default 10
   */
  search(query: string, limit = 10): SearchResult[] {
    return this.searchTokens(this.tokenize(query), limit);
  }

  /**
   * Search using pre-tokenized query tokens
   */
  searchTokens(queryTokens: string[], limit = 10): SearchResult[] {
    const N = this.docs.length;
    if (N === 0 || queryTokens.length === 0) return [];

    const scores = new Map<string, number>();

    for (const term of queryTokens) {
      const df = this.df.get(term) ?? 0;
      if (df === 0) continue;

      // IDF (add smoothing to avoid negative log)
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

      for (const doc of this.docs) {
        const tf = doc.tf.get(term) ?? 0;
        if (tf === 0) continue;

        // BM25 core formula
        const norm = 1 - this.b + this.b * (doc.length / this.avgdl);
        const termScore = idf * ((tf * (this.k1 + 1)) / (tf + this.k1 * norm));

        scores.set(doc.id, (scores.get(doc.id) ?? 0) + termScore);
      }
    }

    return [...scores.entries()]
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Clear the index (used when rebuilding)
   */
  clear(): void {
    this.docs = [];
    this.df.clear();
    this.avgdl = 0;
  }

  /** number of indexed documents */
  get size(): number {
    return this.docs.length;
  }

  /** current average document length (for debugging) */
  get stats(): { size: number; avgdl: number; terms: number } {
    return {
      size: this.docs.length,
      avgdl: Math.round(this.avgdl * 10) / 10,
      terms: this.df.size,
    };
  }
}
