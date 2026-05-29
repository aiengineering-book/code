// #book ch21-notion-test
// ch21-mcp-publish/notion-mcp/src/__tests__/tools.test.ts
import { describe, expect, it, vi } from 'vitest';
import { notionTools } from '../tools.js';

// Mock the Notion client
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
  blocksToMarkdown: vi.fn().mockResolvedValue('Mocked page content'),
}));

describe('notion_search', () => {
  const searchTool = notionTools.find((t) => t.name === 'notion_search')!;

  it('returns search results', async () => {
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
              title: [{ plain_text: 'Test Page' }],
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

    const result = await searchTool.execute({ query: 'test' });
    expect(result).toContain('Test Page');
    expect(result).toContain('page-123');
  });

  it('returns a message when search finds nothing', async () => {
    const { notion } = await import('../notion-client.js');
    vi.mocked(notion.search).mockResolvedValue({
      results: [],
      has_more: false,
      next_cursor: null,
      object: 'list',
      type: 'page_or_database',
      page_or_database: {},
    } as any);

    const result = await searchTool.execute({ query: 'nonexistent content' });
    expect(result).toContain('No content found');
  });

  it('rejects empty queries', async () => {
    await expect(searchTool.execute({ query: '' })).rejects.toThrow();
  });
});

describe('notion_create_page', () => {
  const createTool = notionTools.find((t) => t.name === 'notion_create_page')!;

  it('creates a page successfully', async () => {
    const { notion } = await import('../notion-client.js');
    vi.mocked(notion.pages.create).mockResolvedValue({
      id: 'new-page-id',
      url: 'https://notion.so/new-page-id',
      object: 'page',
    } as any);

    const result = await createTool.execute({
      parentId: 'parent-id',
      parentType: 'page',
      title: 'New Test Page',
      content: 'Page content',
    });

    expect(result).toContain('Page created successfully');
    expect(result).toContain('new-page-id');
  });
});
// #endbook
