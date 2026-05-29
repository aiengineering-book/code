import { beforeEach, describe, expect, it } from 'vitest';
import { BM25Index } from './index.js';
import { tokenize } from './tokenizer.js';

// ─── tokenizer ────────────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('英文分词：小写、过滤停用词和短词', () => {
    const tokens = tokenize('The quick brown fox');
    expect(tokens).toContain('quick');
    expect(tokens).toContain('brown');
    expect(tokens).toContain('fox');
    expect(tokens).not.toContain('the'); // 停用词
  });

  it('中文 bigram：包含单字和双字', () => {
    const tokens = tokenize('人工智能');
    expect(tokens).toContain('人');
    expect(tokens).toContain('人工');
    expect(tokens).toContain('智能');
  });

  it('中英混合', () => {
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

  it('空索引返回空结果', () => {
    expect(index.search('hello')).toEqual([]);
  });

  it('精确匹配排在第一', () => {
    index.add('doc1', 'TypeScript 全栈开发指南');
    index.add('doc2', 'Python 机器学习入门');
    index.add('doc3', 'TypeScript 类型系统深入解析');

    const results = index.search('TypeScript');
    expect(results[0]?.id).toMatch(/doc[13]/); // doc1 或 doc3
    expect(results.every((r) => r.score > 0)).toBe(true);
  });

  it('无匹配词返回空数组', () => {
    index.add('doc1', 'hello world');
    expect(index.search('量子计算')).toEqual([]);
  });

  it('limit 参数生效', () => {
    for (let i = 0; i < 20; i++) {
      index.add(`doc${i}`, `TypeScript 开发 示例 ${i}`);
    }
    const results = index.search('TypeScript', 5);
    expect(results).toHaveLength(5);
  });

  it('高频词文档得分更高', () => {
    // 用 addTokens 绕过分词，精确控制 TF，确保得分差异不被长度归一化抵消：
    // doc1: "rag" 出现 5 次，共 7 个 token → TF 高、密度高
    // doc2: "rag" 出现 1 次，共 10 个 token → TF 低、密度低
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

  it('clear() 清空后重建', () => {
    index.add('doc1', 'hello world');
    index.clear();
    expect(index.size).toBe(0);
    expect(index.search('hello')).toEqual([]);

    index.add('doc2', 'hello again');
    expect(index.search('hello')).toHaveLength(1);
  });

  it('stats() 返回正确元数据', () => {
    index.add('doc1', 'TypeScript 开发');
    index.add('doc2', 'Python 机器学习');
    const { size, terms } = index.stats;
    expect(size).toBe(2);
    expect(terms).toBeGreaterThan(0);
  });

  it('自定义分词器', () => {
    const customIndex = new BM25Index({
      tokenizer: (text) => text.split(/\s+/),
    });
    customIndex.add('doc1', 'hello world');
    const results = customIndex.search('hello');
    expect(results[0]?.id).toBe('doc1');
  });

  it('addTokens() 跳过内部分词', () => {
    index.addTokens('doc1', ['typescript', 'react', 'node']);
    const results = index.searchTokens(['typescript']);
    expect(results[0]?.id).toBe('doc1');
  });

  it('结果按 score 降序排列', () => {
    index.add('doc1', 'AI Agent 工具调用工具'); // "工具" 出现 2 次
    index.add('doc2', 'AI Agent 架构');
    index.add('doc3', 'AI 工具链');

    const results = index.search('工具');
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]?.score).toBeGreaterThanOrEqual(results[i]?.score);
    }
  });
});
