// packages/server/src/lib/agent/tools/web/search-tool.ts
// #book ch14-search-tool
import { z } from 'zod';
// ch14-tool-calling/server/src/lib/agent/tools/web/search-tool.ts
import { env } from '../../../../env.js';

const SearchInput = z.object({
  query: z.string().min(1).max(200),
  maxResults: z.number().int().min(1).max(10).default(5),
});

export const webSearchTool = {
  name: 'web_search',
  description: `在互联网上搜索实时信息。
适合：最新新闻、当前价格、近期事件、你不确定的事实。
不适合：数学计算、代码执行、文件操作。
返回最多 10 条结果，包含标题、链接和摘要。`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词，建议使用简洁的关键词而非长句',
      },
      maxResults: {
        type: 'number',
        description: '返回结果数量，默认 5，最大 10',
      },
    },
    required: ['query'],
  },
  execute: async (input: Record<string, unknown>): Promise<string> => {
    const parsed = SearchInput.safeParse(input);
    if (!parsed.success) {
      return JSON.stringify({
        error: '参数错误',
        details: parsed.error.flatten(),
      });
    }

    const { query, maxResults } = parsed.data;

    try {
      // 使用 Tavily Search API（专为 AI 设计的搜索 API）
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.TAVILY_API_KEY}`,
        },
        body: JSON.stringify({
          query,
          max_results: maxResults,
          search_depth: 'basic',
        }),
      });

      if (!response.ok) throw new Error(`搜索 API 错误：${response.status}`);

      const data = (await response.json()) as {
        results?: Array<{ title: string; url: string; content?: string }>;
      };

      return JSON.stringify({
        success: true,
        data: {
          results:
            data.results?.map((r) => ({
              title: r.title,
              url: r.url,
              snippet: r.content?.slice(0, 300),
            })) ?? [],
          totalResults: data.results?.length ?? 0,
        },
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : '搜索失败',
      });
    }
  },
};
// #endbook
