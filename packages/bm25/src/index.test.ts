import { beforeEach, describe, expect, it } from 'vitest';
import { BM25Index } from './index.js';
import { tokenize } from './tokenizer.js';

// ─── tokenizer ────────────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('English tokenizer: lowercase, filter stopwords and short words', () => {
    const tokens = tokenize('The quick brown fox');
    expect(tokens).toContain('quick');
    expect(tokens).toContain('brown');
    expect(tokens).toContain('fox');
    expect(tokens).not.toContain('the'); // stopword
  });

  it('Chinese bigram: includes single chars and bigrams', () => {
    const tokens = tokenize('人工智能');
    expect(tokens).toContain('人');
    expect(tokens).toContain('人工');
    expect(tokens).toContain('智能');
  });

  it('Mixed Chinese/English', () => {
    const tokens = tokenize('TypeScript 是一门编程语言');
    expect(tokens).toContain('typescript');
    expect(tokens).toContain('编程');
    expect(tokens).toContain('语言');
  });
});

// ─── BM25Index ────────────────────────────────────────────────────────────────

describe('BM25Index', () => {
  let index: BM25Index;

  beforeEach(() => {
    index = new BM25Index();
  });

  it('empty index returns empty results', () => {
    expect(index.search('hello')).toEqual([]);
  });

  it('exact match ranks first', () => {
    index.add('doc1', 'TypeScript 全栈开发指南');
    index.add('doc2', 'Python 机器学习入门');
    index.add('doc3', 'TypeScript 类型系统深入解析');

    const results = index.search('TypeScript');
    expect(results[0]?.id).toMatch(/doc[13]/); // doc1 or doc3
    expect(results.every((r) => r.score > 0)).toBe(true);
  });

  it('no matching term returns empty array', () => {
    index.add('doc1', 'hello world');
    expect(index.search('量子计算')).toEqual([]);
  });

  it('limit parameter is respected', () => {
    for (let i = 0; i < 20; i++) {
      index.add(`doc${i}`, `TypeScript 开发 示例 ${i}`);
    }
    const results = index.search('TypeScript', 5);
    expect(results).toHaveLength(5);
  });

  it('document with higher term frequency scores higher', () => {
    // Use addTokens to bypass tokenization, precisely control TF, ensure score difference is not negated by length normalization:
    // doc1: "rag" appears 5 times out of 7 tokens → high TF, high density
    // doc2: "rag" appears 1 time out of 10 tokens → low TF, low density
    index.addTokens('doc1', [
      'rag',
      'rag',
      'rag',
      'rag',
      'rag',
      'retrieval',
      'generation',
    ]);
    index.addTokens('doc2', [
      'rag',
      'intro',
      'overview',
      'search',
      'llm',
      'context',
      'prompt',
      'output',
      'answer',
      'summary',
    ]);

    const results = index.searchTokens(['rag']);
    expect(results[0]?.id).toBe('doc1');
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score);
  });

  it('clear() resets and allows rebuild', () => {
    index.add('doc1', 'hello world');
    index.clear();
    expect(index.size).toBe(0);
    expect(index.search('hello')).toEqual([]);

    index.add('doc2', 'hello again');
    expect(index.search('hello')).toHaveLength(1);
  });

  it('stats() returns correct metadata', () => {
    index.add('doc1', 'TypeScript 开发');
    index.add('doc2', 'Python 机器学习');
    const { size, terms } = index.stats;
    expect(size).toBe(2);
    expect(terms).toBeGreaterThan(0);
  });

  it('custom tokenizer', () => {
    const customIndex = new BM25Index({
      tokenizer: (text) => text.split(/\s+/),
    });
    customIndex.add('doc1', 'hello world');
    const results = customIndex.search('hello');
    expect(results[0]?.id).toBe('doc1');
  });

  it('addTokens() skips internal tokenization', () => {
    index.addTokens('doc1', ['typescript', 'react', 'node']);
    const results = index.searchTokens(['typescript']);
    expect(results[0]?.id).toBe('doc1');
  });

  it('results are sorted by score descending', () => {
    index.add('doc1', 'AI Agent 工具调用工具'); // "工具" appears 2 times
    index.add('doc2', 'AI Agent 架构');
    index.add('doc3', 'AI 工具链');

    const results = index.search('工具');
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]?.score).toBeGreaterThanOrEqual(results[i]?.score);
    }
  });
});
