// #book ch21-notion-test
import { describe, expect, it, vi } from 'vitest';
// ch21-mcp-publish/notion-mcp/src/__tests__/tools.test.ts
import { notionTools } from '../tools.js';

// Mock Notion 客户端
vi.mock('../notion-client.js', () => ({
  notion: {
    search: vi.fn(),
    pages: {
      retrieve: vi.fn(),
      create: vi.fn(),
    },
    databases: {
      query: vi.fn(),
    },
    blocks: {
      children: { list: vi.fn() },
    },
  },
  richTextToPlainText: (rt: Array<{ plain_text: string }>) =>
    rt.map((t) => t.plain_text).join(''),
  blocksToMarkdown: vi.fn().mockResolvedValue('模拟页面内容'),
}));

describe('notion_search', () => {
  const searchTool = notionTools.find((t) => t.name === 'notion_search')!;

  it('返回搜索结果', async () => {
    const { notion } = await import('../notion-client.js');
    vi.mocked(notion.search).mockResolvedValue({
      results: [
        {
          object: 'page',
          id: 'page-123',
          url: 'https://notion.so/page-123',
          properties: {
            title: {
              id: 'title',
              type: 'title',
              title: [{ plain_text: '测试页面' }],
            },
          },
        },
      ],
      has_more: false,
      next_cursor: null,
      object: 'list',
      type: 'page_or_database',
      page_or_database: {},
    } as any);

    const result = await searchTool.execute({ query: '测试' });
    expect(result).toContain('测试页面');
    expect(result).toContain('page-123');
  });

  it('搜索无结果时返回提示', async () => {
    const { notion } = await import('../notion-client.js');
    vi.mocked(notion.search).mockResolvedValue({
      results: [],
      has_more: false,
      next_cursor: null,
      object: 'list',
      type: 'page_or_database',
      page_or_database: {},
    } as any);

    const result = await searchTool.execute({ query: '不存在的内容' });
    expect(result).toContain('未找到');
  });

  it('拒绝空查询', async () => {
    await expect(searchTool.execute({ query: '' })).rejects.toThrow();
  });
});

describe('notion_create_page', () => {
  const createTool = notionTools.find((t) => t.name === 'notion_create_page')!;

  it('成功创建页面', async () => {
    const { notion } = await import('../notion-client.js');
    vi.mocked(notion.pages.create).mockResolvedValue({
      id: 'new-page-id',
      url: 'https://notion.so/new-page-id',
      object: 'page',
    } as any);

    const result = await createTool.execute({
      parentId: 'parent-id',
      parentType: 'page',
      title: '新建测试页面',
      content: '页面内容',
    });

    expect(result).toContain('页面创建成功');
    expect(result).toContain('new-page-id');
  });
});
// #endbook
