import { tokenize as defaultTokenize, type Tokenizer } from './tokenizer.js';

/**
 * BM25Index — Okapi BM25 全文检索
 *
 * 参数默认值沿用学术界标准：
 *   k1 = 1.5  词频饱和因子：越大，高频词得分提升越显著
 *   b  = 0.75 文档长度归一化：1.0 = 完全按长度惩罚，0 = 忽略长度
 *
 * 参考：Robertson & Zaragoza (2009), "The Probabilistic Relevance Framework: BM25 and Beyond"
 */

interface DocEntry {
  id: string;
  /** term → 在本文档中出现的次数（TF） */
  tf: Map<string, number>;
  /** 文档 token 总数（文档长度） */
  length: number;
}

export interface SearchResult {
  id: string;
  score: number;
}

export interface BM25Options {
  /** 词频饱和因子，默认 1.5 */
  k1?: number;
  /** 文档长度归一化因子，默认 0.75 */
  b?: number;
  /** 自定义分词器，默认内置中英文混合分词 */
  tokenizer?: Tokenizer;
}

export class BM25Index {
  private docs: DocEntry[] = [];
  /** term → 出现该 term 的文档数（DF） */
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
   * 添加一篇文档
   * @param id    文档唯一标识（搜索结果中返回）
   * @param text  原始文本，由内部分词器处理
   */
  add(id: string, text: string): void {
    this.addTokens(id, this.tokenize(text));
  }

  /**
   * 添加已分好词的文档（跳过内部分词，适合批量预处理）
   */
  addTokens(id: string, tokens: string[]): void {
    const tf = new Map<string, number>();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) ?? 0) + 1);
    }

    this.docs.push({ id, tf, length: tokens.length });

    // 更新 DF
    for (const term of tf.keys()) {
      this.df.set(term, (this.df.get(term) ?? 0) + 1);
    }

    // 增量维护平均文档长度（避免每次重算）
    this.avgdl =
      (this.avgdl * (this.docs.length - 1) + tokens.length) / this.docs.length;
  }

  /**
   * 搜索
   * @param query 原始查询文本
   * @param limit 最多返回多少条结果，默认 10
   */
  search(query: string, limit = 10): SearchResult[] {
    return this.searchTokens(this.tokenize(query), limit);
  }

  /**
   * 用已分好词的 query tokens 搜索
   */
  searchTokens(queryTokens: string[], limit = 10): SearchResult[] {
    const N = this.docs.length;
    if (N === 0 || queryTokens.length === 0) return [];

    const scores = new Map<string, number>();

    for (const term of queryTokens) {
      const df = this.df.get(term) ?? 0;
      if (df === 0) continue;

      // IDF（加平滑，避免 log 为负）
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

      for (const doc of this.docs) {
        const tf = doc.tf.get(term) ?? 0;
        if (tf === 0) continue;

        // BM25 核心公式
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
   * 清空索引（重建时使用）
   */
  clear(): void {
    this.docs = [];
    this.df.clear();
    this.avgdl = 0;
  }

  /** 已索引的文档数 */
  get size(): number {
    return this.docs.length;
  }

  /** 当前平均文档长度（调试用） */
  get stats(): { size: number; avgdl: number; terms: number } {
    return {
      size: this.docs.length,
      avgdl: Math.round(this.avgdl * 10) / 10,
      terms: this.df.size,
    };
  }
}
